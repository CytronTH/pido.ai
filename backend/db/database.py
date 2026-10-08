from datetime import timezone
import json
import logging
from pathlib import Path
from queue import Queue, Full
import threading
import time
from datetime import datetime, timedelta
from typing import Generator, List, Dict, Any, Optional
from sqlalchemy import event, text
import hashlib
import shutil
from sqlmodel import SQLModel, create_engine, Session, select, func, delete
# Import models to ensure they are registered with SQLModel before create_all
from .models import *

logger = logging.getLogger("ai_engine")

class DatabaseManager:
    def __init__(self, db_path: str = None):
        if db_path is None:
            base_dir = Path(__file__).resolve().parent
            db_path = str(base_dir / "vision_studio.sqlite")
        
        self.db_path = db_path
        sqlite_url = f"sqlite:///{self.db_path}"
        
        self.db_path_telemetry = str(base_dir / "telemetry_logs.sqlite")
        sqlite_url_telemetry = f"sqlite:///{self.db_path_telemetry}"
        
        connect_args = {"check_same_thread": False}
        self.engine = create_engine(sqlite_url, connect_args=connect_args)
        self.engine_telemetry = create_engine(sqlite_url_telemetry, connect_args=connect_args)
        
        # Configure SQLite Pragmas for performance and concurrency resilience
        def setup_pragmas(engine):
            @event.listens_for(engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA journal_mode=WAL;")
                cursor.execute("PRAGMA synchronous=NORMAL;")
                cursor.execute("PRAGMA busy_timeout=5000;")
                cursor.execute("PRAGMA foreign_keys=ON;")
                cursor.close()
                
        setup_pragmas(self.engine)
        setup_pragmas(self.engine_telemetry)
        
        self._init_db()
        self._reconcile_existing_models()
        
        # Bounded queue to avoid Out-Of-Memory (OOM) on Raspberry Pi
        self.log_queue = Queue(maxsize=10000)
        self.running = True
        self.writer_thread = threading.Thread(target=self._background_writer, daemon=True)
        self.writer_thread.start()
        
    def _init_db(self):
        try:
            # Create all tables (safe to call multiple times)
            SQLModel.metadata.create_all(self.engine)
            SQLModel.metadata.create_all(self.engine_telemetry)
            
            # Ensure indexes are explicitly created for existing tables
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs(timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs(event_type);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_camera_id ON event_logs(camera_id);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_node_id ON event_logs(node_id);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_type_time ON event_logs(event_type, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_cam_time ON event_logs(camera_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_node_time ON event_logs(node_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_event_logs_proj_time ON event_logs(project_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_custom_metric_time ON custom_metric_log(timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_custom_metric_proj_time ON custom_metric_log(project_id, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_custom_metric_full ON custom_metric_log(project_id, node_id, variable_name, timestamp DESC);",
                "CREATE INDEX IF NOT EXISTS idx_custom_metric_var ON custom_metric_log(variable_name, timestamp DESC);",
            ]
            with self.engine_telemetry.connect() as conn:
                for idx_sql in indexes:
                    conn.execute(text(idx_sql))
                conn.commit()
                
            with self.engine.connect() as conn:
                # Schema migrations for newly added columns
                try:
                    conn.execute(text("ALTER TABLE camera ADD COLUMN is_enabled BOOLEAN DEFAULT 1;"))
                    conn.commit()
                except Exception:
                    pass  # Column already exists

                # AIModel schema migrations
                for col_sql in [
                    "ALTER TABLE aimodel ADD COLUMN original_filename VARCHAR DEFAULT '';",
                    "ALTER TABLE aimodel ADD COLUMN file_hash VARCHAR DEFAULT '';",
                    "ALTER TABLE aimodel ADD COLUMN file_size INTEGER DEFAULT 0;",
                    "ALTER TABLE aimodel ADD COLUMN version VARCHAR DEFAULT 'v1.0';",
                    "ALTER TABLE aimodel ADD COLUMN description VARCHAR DEFAULT '';",
                ]:
                    try:
                        conn.execute(text(col_sql))
                        conn.commit()
                    except Exception:
                        pass
                
            from db.auth import get_password_hash
            from sqlmodel import Session, select
            from db.models import User
            
            with Session(self.engine) as session:
                admin_user = session.exec(select(User).where(User.username == "admin")).first()
                if not admin_user:
                    admin_user = User(
                        username="admin",
                        hashed_password=get_password_hash("admin"),
                        role="admin",
                        is_active=True
                    )
                    session.add(admin_user)
                    session.commit()
                    logger.info("Created default admin user (admin/admin).")

            logger.info(f"Database initialized successfully with indexes at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")

    def _reconcile_existing_models(self):
        """Populate missing metadata (hash, size, version) for existing models and resolve file collisions."""
        try:
            models_dir = Path(__file__).resolve().parent.parent / "models"
            with Session(self.engine) as session:
                models = session.exec(select(AIModel)).all()
                modified = False
                for m in models:
                    needs_update = False
                    if not m.original_filename:
                        m.original_filename = Path(m.hef_path).name if m.hef_path else ""
                        needs_update = True
                    if not m.version:
                        m.version = "v1.0"
                        needs_update = True
                    
                    # Specific resolution for known collision: Gallon Detector (model_1788861629)
                    if m.id == "model_1788861629" and m.hef_path == "best.hef":
                        src_best = models_dir / "best.hef"
                        dest_best = models_dir / "model_1788861629_best.hef"
                        if src_best.exists() and not dest_best.exists():
                            shutil.copy2(src_best, dest_best)
                            logger.info(f"Copied Gallon Detector model from {src_best} to {dest_best}")
                        m.hef_path = "model_1788861629_best.hef"
                        needs_update = True

                    # Calculate hash and size if file exists on disk
                    if m.hef_path:
                        file_path = models_dir / m.hef_path
                        if file_path.exists() and file_path.is_file():
                            if not m.file_size or m.file_size == 0:
                                m.file_size = file_path.stat().st_size
                                needs_update = True
                            if not m.file_hash:
                                h = hashlib.sha256()
                                with open(file_path, "rb") as f:
                                    while chunk := f.read(65536):
                                        h.update(chunk)
                                m.file_hash = h.hexdigest()
                                needs_update = True
                    
                    if needs_update:
                        session.add(m)
                        modified = True
                
                if modified:
                    session.commit()
                    logger.info("AIModel reconciliation and metadata population completed.")
        except Exception as e:
            logger.warning(f"Failed to reconcile existing models: {e}")
            
    def get_session(self) -> Generator[Session, None, None]:
        """Provides a database session for FastAPI dependencies."""
        with Session(self.engine) as session:
            yield session
            
    def _background_writer(self):
        """Background thread for high-frequency logs using batch commits to minimize disk I/O."""
        batch_size = 500
        batch_timeout = 5.0  # seconds (increased to save SD card wear)
        last_rollup_check = time.time()
        
        while self.running:
            # Check for cleanup every hour (3600 seconds)
            if not hasattr(self, 'last_cleanup_check'):
                self.last_cleanup_check = time.time()
                
            if time.time() - self.last_cleanup_check > 3600:
                self.run_data_retention_cleanup()
                self.last_cleanup_check = time.time()
                
            # Check for rollup every 5 minutes
            if time.time() - last_rollup_check > 300:
                self.run_hourly_rollup()
                last_rollup_check = time.time()
                
            entries = []
            start_time = time.time()
            
            # Collect items up to batch_size or until batch_timeout expires
            while len(entries) < batch_size and (time.time() - start_time) < batch_timeout:
                try:
                    remaining_timeout = max(0.05, batch_timeout - (time.time() - start_time))
                    entry = self.log_queue.get(timeout=remaining_timeout)
                    if entry is None:
                        # Termination signal received
                        break
                    entries.append(entry)
                except Exception:
                    # Timeout on log_queue.get, break out to commit whatever collected
                    break
                    
            if not entries:
                continue
                
            with Session(self.engine_telemetry) as session:
                try:
                    for log_entry in entries:
                        if log_entry['table'] == 'event_logs':
                            event = EventLog(
                                node_id=log_entry.get('node_id'),
                                project_id=log_entry.get('project_id'),
                                event_type=log_entry.get('event_type'),
                                payload=json.dumps(log_entry.get('payload')) if log_entry.get('payload') else None,
                                camera_id=log_entry.get('camera_id'),
                                snapshot_path=log_entry.get('snapshot_path')
                            )
                            session.add(event)
                        elif log_entry['table'] == 'system_metrics':
                            metric = SystemMetric(
                                cpu_percent=log_entry.get('cpu_percent'),
                                ram_percent=log_entry.get('ram_percent'),
                                temp_c=log_entry.get('temp_c')
                            )
                            session.add(metric)
                        elif log_entry['table'] == 'custom_metric_log':
                            from db.models import CustomMetricLog
                            metric = CustomMetricLog(
                                timestamp=log_entry.get('data', {}).get('timestamp') or datetime.now(timezone.utc),
                                project_id=log_entry.get('data', {}).get('project_id', 'default'),
                                node_id=log_entry.get('data', {}).get('node_id', 'unknown'),
                                variable_name=log_entry.get('data', {}).get('variable_name'),
                                value=log_entry.get('data', {}).get('value', 0.0)
                            )
                            session.add(metric)
                        elif log_entry['table'] == 'collection_records':
                            from db.models import CollectionRecord
                            session.add(CollectionRecord(
                                collection_id=log_entry['collection_id'],
                                project_id=log_entry['project_id'],
                                timestamp=log_entry.get('timestamp') or datetime.now(timezone.utc),
                                data_json=log_entry.get('data_json', '{}')
                            ))
                    session.commit()
                except Exception as e:
                    session.rollback()
                    logger.error(f"Error writing batch to database ({len(entries)} items): {e}")
                finally:
                    for _ in entries:
                        self.log_queue.task_done()

    def log_event(self, node_id: str, event_type: str, payload: dict, camera_id: str = None, snapshot_path: str = None, project_id: str = None):
        try:
            self.log_queue.put_nowait({
                'table': 'event_logs',
                'node_id': node_id,
                'project_id': project_id,
                'event_type': event_type,
                'payload': payload,
                'camera_id': camera_id,
                'snapshot_path': snapshot_path
            })
        except Full:
            logger.warning("Database log_queue is full (max 10000). Dropping log event to prevent memory exhaustion.")
        
    def log_metric(self, cpu_percent: float, ram_percent: float, temp_c: float):
        try:
            self.log_queue.put_nowait({
                'table': 'system_metrics',
                'cpu_percent': cpu_percent,
                'ram_percent': ram_percent,
                'temp_c': temp_c
            })
        except Full:
            logger.warning("Database log_queue is full (max 10000). Dropping metric to prevent memory exhaustion.")
            

    def get_metric_history(
        self, 
        node_id: str, 
        limit: int = 300, 
        timeframe_min: Optional[int] = None, 
        aggregate_min: Optional[int] = None,
        agg_func: str = "avg"
    ) -> List[Dict[str, Any]]:
        """Fetch time-series history for a node/variable from telemetry database using SQL aggregation."""
        from sqlalchemy import text
        from datetime import datetime, timedelta, timezone

        try:
            with self.engine_telemetry.connect() as conn:
                where_clauses = ["(node_id = :node_id OR variable_name = :node_id)"]
                params: Dict[str, Any] = {"node_id": node_id, "limit": limit}

                if timeframe_min and timeframe_min > 0:
                    cutoff = datetime.now(timezone.utc) - timedelta(minutes=timeframe_min)
                    cutoff_str = cutoff.strftime("%Y-%m-%d %H:%M:%S")
                    where_clauses.append("timestamp >= :cutoff")
                    params["cutoff"] = cutoff_str

                where_sql = " AND ".join(where_clauses)

                if aggregate_min and aggregate_min > 0:
                    bucket_sec = aggregate_min * 60
                    agg_lower = (agg_func or "avg").lower()
                    if agg_lower == "max":
                        agg_expr = "MAX(value)"
                        hourly_col = "value_max"
                    elif agg_lower == "min":
                        agg_expr = "MIN(value)"
                        hourly_col = "value_min"
                    elif agg_lower == "sum":
                        agg_expr = "SUM(value)"
                        hourly_col = "value_sum"
                    else:
                        agg_expr = "AVG(value)"
                        hourly_col = "value_avg"

                    query = text(f"""
                        SELECT 
                            (CAST(strftime('%s', timestamp) AS INTEGER) / {bucket_sec}) * {bucket_sec} AS bucket_ts,
                            {agg_expr} AS agg_val,
                            variable_name
                        FROM (
                            SELECT timestamp, value, variable_name, node_id FROM custom_metric_log
                            UNION ALL
                            SELECT time_bucket AS timestamp, {hourly_col} AS value, variable_name, node_id 
                            FROM custom_metric_hourly
                            WHERE time_bucket < (
                                SELECT COALESCE(MIN(timestamp), '9999-12-31') 
                                FROM custom_metric_log 
                                WHERE (node_id = :node_id OR variable_name = :node_id)
                            )
                        )
                        WHERE {where_sql}
                        GROUP BY bucket_ts
                        ORDER BY bucket_ts ASC
                        LIMIT :limit
                    """)
                    result = conn.execute(query, params)
                    history = []
                    for row in result:
                        bts = row[0]
                        val = round(row[1], 2) if row[1] is not None else 0.0
                        var_name = row[2] or ""
                        if timeframe_min and timeframe_min > 1440:
                            dt_str = datetime.fromtimestamp(bts).strftime("%d/%m %H:%M")
                        else:
                            dt_str = datetime.fromtimestamp(bts).strftime("%H:%M")
                        history.append({
                            "time": dt_str,
                            "timestamp_unix": bts,
                            "value": val,
                            "variable_name": var_name
                        })
                    return history
                else:
                    query = text(f"""
                        SELECT 
                            CAST(strftime('%s', timestamp) AS INTEGER) AS ts_unix,
                            value,
                            variable_name
                        FROM custom_metric_log
                        WHERE {where_sql}
                        ORDER BY timestamp DESC
                        LIMIT :limit
                    """)
                    result = conn.execute(query, params)
                    rows = result.fetchall()
                    history = []
                    for row in reversed(rows):
                        ts = row[0]
                        val = round(row[1], 2) if row[1] is not None else 0.0
                        var_name = row[2] or ""
                        dt_str = datetime.fromtimestamp(ts).strftime("%H:%M:%S")
                        history.append({
                            "time": dt_str,
                            "timestamp_unix": ts,
                            "value": val,
                            "variable_name": var_name
                        })
                    return history
        except Exception as e:
            logger.error(f"Failed to fetch metric history for {node_id}: {e}")
            return []

    def run_hourly_rollup(self):
        """Aggregates raw custom metrics into hourly buckets in custom_metric_hourly."""
        from sqlalchemy import text
        from datetime import datetime, timezone
        try:
            now_hour = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%S")
            with self.engine_telemetry.connect() as conn:
                sql = text("""
                    INSERT OR REPLACE INTO custom_metric_hourly (
                        time_bucket, project_id, node_id, variable_name, 
                        value_sum, value_avg, value_max, value_min, count
                    )
                    SELECT 
                        strftime('%Y-%m-%d %H:00:00', timestamp) AS time_bucket,
                        project_id,
                        node_id,
                        variable_name,
                        ROUND(SUM(value), 4) AS value_sum,
                        ROUND(AVG(value), 4) AS value_avg,
                        ROUND(MAX(value), 4) AS value_max,
                        ROUND(MIN(value), 4) AS value_min,
                        COUNT(id) AS count
                    FROM custom_metric_log
                    WHERE timestamp < :now_hour
                    GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp), project_id, node_id, variable_name;
                """)
                res = conn.execute(sql, {"now_hour": now_hour})
                conn.commit()
                if res.rowcount and res.rowcount > 0:
                    logger.info(f"Hourly rollup generated/updated {res.rowcount} hourly metric records.")
        except Exception as e:
            logger.error(f"Error running hourly rollup: {e}")
            
    def run_data_retention_cleanup(self):
        """Deletes raw data older than the retention period (default 7 days) to prevent disk bloat."""
        from sqlalchemy import text
        from datetime import datetime, timedelta, timezone
        import os
        
        # 1. Rollup raw data to hourly buckets before purging
        self.run_hourly_rollup()
        
        retention_days = 7
        hourly_retention_days = 90
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
        cutoff_str = cutoff_date.strftime("%Y-%m-%d %H:%M:%S")
        hourly_cutoff_str = (datetime.now(timezone.utc) - timedelta(days=hourly_retention_days)).strftime("%Y-%m-%d %H:%M:%S")
        
        try:
            with self.engine_telemetry.connect() as conn:
                # 1. Find and delete physical snapshot files
                old_events = conn.execute(
                    text("SELECT snapshot_path FROM event_logs WHERE timestamp < :cutoff AND snapshot_path IS NOT NULL"),
                    {"cutoff": cutoff_str}
                ).fetchall()
                
                deleted_files_count = 0
                for row in old_events:
                    snap_path = row[0]
                    if snap_path and os.path.exists(snap_path):
                        try:
                            os.remove(snap_path)
                            deleted_files_count += 1
                        except Exception as e:
                            logger.error(f"Failed to delete old snapshot file {snap_path}: {e}")

                # 2. Clean up raw CustomMetricLog (safely preserved in custom_metric_hourly)
                res1 = conn.execute(text("DELETE FROM custom_metric_log WHERE timestamp < :cutoff"), {"cutoff": cutoff_str})
                # 3. Clean up custom_metric_hourly older than 90 days
                res_h = conn.execute(text("DELETE FROM custom_metric_hourly WHERE time_bucket < :hourly_cutoff"), {"hourly_cutoff": hourly_cutoff_str})
                # 4. Clean up EventLog
                res2 = conn.execute(text("DELETE FROM event_logs WHERE timestamp < :cutoff"), {"cutoff": cutoff_str})
                # 5. Clean up SystemMetric
                res3 = conn.execute(text("DELETE FROM system_metrics WHERE timestamp < :cutoff"), {"cutoff": cutoff_str})
                
                conn.commit()
                
                # 6. Optimize SQLite storage to prevent fragmentation on Raspberry Pi SD card
                try:
                    conn.execute(text("PRAGMA optimize;"))
                    conn.commit()
                except Exception:
                    pass
                
                deleted_total = (res1.rowcount or 0) + (res2.rowcount or 0) + (res3.rowcount or 0) + (res_h.rowcount or 0)
                if deleted_total > 0 or deleted_files_count > 0:
                    logger.info(f"Data retention cleanup completed. Deleted {deleted_total} old rows and {deleted_files_count} snapshot files.")
        except Exception as e:
            logger.error(f"Error running data retention cleanup: {e}")
        
    def get_logs(
        self,
        limit: int = 100,
        node_id: Optional[str] = None,
        event_type: Optional[str] = None,
        camera_id: Optional[str] = None,
        page: int = 1,
        project_id: Optional[str] = None,
        tag: Optional[str] = None
    ) -> Dict[str, Any]:
        """Helper to get raw dict logs for backwards compatibility, with pagination and filters."""
        with Session(self.engine_telemetry) as session:
            statement = select(EventLog)
            count_statement = select(func.count(EventLog.id))
            
            if project_id:
                statement = statement.where(EventLog.project_id == project_id)
                count_statement = count_statement.where(EventLog.project_id == project_id)
            if node_id:
                statement = statement.where(EventLog.node_id == node_id)
                count_statement = count_statement.where(EventLog.node_id == node_id)
            if event_type:
                statement = statement.where(EventLog.event_type == event_type)
                count_statement = count_statement.where(EventLog.event_type == event_type)
            if camera_id:
                statement = statement.where(EventLog.camera_id == camera_id)
                count_statement = count_statement.where(EventLog.camera_id == camera_id)
            if tag:
                tag_cond = text(
                    "event_logs.payload IS NOT NULL "
                    "AND json_valid(event_logs.payload) = 1 "
                    "AND EXISTS (SELECT 1 FROM json_each(event_logs.payload, '$.tags') WHERE LOWER(json_each.value) = LOWER(:tag))"
                ).params(tag=tag)
                statement = statement.where(tag_cond)
                count_statement = count_statement.where(tag_cond)
                
            total = session.exec(count_statement).one()
            
            offset = (page - 1) * limit
            statement = statement.order_by(EventLog.timestamp.desc()).offset(offset).limit(limit)
            
            results = session.exec(statement).all()
            
            out = []
            for r in results:
                d = r.model_dump()
                if d.get('payload'):
                    try:
                        d['payload'] = json.loads(d['payload'])
                    except:
                        pass
                if d.get('timestamp'):
                    d['timestamp'] = d['timestamp'].isoformat()
                out.append(d)
            return {"data": out, "total": total, "page": page, "limit": limit}

    def get_log_tags(self, project_id: Optional[str] = None) -> List[str]:
        """Fetch distinct snapshot tags from event_logs payload for filtering."""
        with Session(self.engine_telemetry) as session:
            try:
                base_sql = (
                    "SELECT DISTINCT j.value "
                    "FROM event_logs l, json_each(l.payload, '$.tags') j "
                    "WHERE l.payload IS NOT NULL "
                    "  AND json_valid(l.payload) = 1 "
                    "  AND l.payload LIKE '%\"tags\"%' "
                )
                if project_id:
                    stmt = text(base_sql + " AND l.project_id = :project_id ORDER BY j.value ASC").params(project_id=project_id)
                else:
                    stmt = text(base_sql + " ORDER BY j.value ASC")
                results = session.exec(stmt).fetchall()
                clean_tags = []
                seen = set()
                for r in results:
                    val = str(r[0]).strip() if r[0] is not None else ""
                    if val and val.lower() not in seen:
                        seen.add(val.lower())
                        clean_tags.append(val)
                return clean_tags
            except Exception as e:
                logger.error(f"Error fetching log tags: {e}")
                return []

    def purge_old_logs(self, days: int = 30, max_records: int = 500000, delete_files: bool = True, project_id: str = None) -> Dict[str, Any]:
        """
        Cleans up old logs and optional snapshot image files to prevent disk bloat.
        1. Removes logs older than `days`.
        2. If record count still exceeds `max_records`, trims oldest records to reach `max_records`.
        3. If `delete_files` is True, deletes matching snapshot image files from disk.
        """
        # Also trigger telemetry downsampling & retention cleanup
        try:
            self.run_data_retention_cleanup()
        except Exception as re_err:
            logger.error(f"Failed to run telemetry retention cleanup in purge_old_logs: {re_err}")

        deleted_rows = 0
        deleted_files = 0
        errors = []

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        with Session(self.engine_telemetry) as session:
            try:
                base_query = select(EventLog)
                count_query = select(func.count(EventLog.id))
                old_logs_stmt = select(EventLog.id, EventLog.snapshot_path).where(EventLog.timestamp < cutoff_date)
                
                if project_id:
                    count_query = count_query.where(EventLog.project_id == project_id)
                    old_logs_stmt = old_logs_stmt.where(EventLog.project_id == project_id)
                
                total_count = session.exec(count_query).one()
                
                # Query IDs to delete by age
                old_logs = session.exec(old_logs_stmt).all()
                
                ids_to_delete = {log_id for log_id, _ in old_logs}
                files_to_delete = [snap for _, snap in old_logs if snap]
                
                # Check if count after age purge still exceeds max_records
                remaining_count = total_count - len(ids_to_delete)
                if remaining_count > max_records:
                    overflow = remaining_count - max_records
                    excess_stmt = (
                        select(EventLog.id, EventLog.snapshot_path)
                        .where(EventLog.id.not_in(ids_to_delete) if ids_to_delete else True)
                    )
                    if project_id:
                        excess_stmt = excess_stmt.where(EventLog.project_id == project_id)
                    
                    excess_stmt = excess_stmt.order_by(EventLog.timestamp.asc()).limit(overflow)
                    excess_logs = session.exec(excess_stmt).all()
                    for eid, snap in excess_logs:
                        ids_to_delete.add(eid)
                        if snap:
                            files_to_delete.append(snap)
                            
                if ids_to_delete:
                    # Delete snapshot files from disk
                    if delete_files:
                        for fpath_str in files_to_delete:
                            try:
                                fpath = Path(fpath_str)
                                if fpath.is_file() and fpath.exists():
                                    fpath.unlink()
                                    deleted_files += 1
                            except Exception as fe:
                                errors.append(f"Failed to delete {fpath_str}: {fe}")
                                
                    # Delete rows in chunks to prevent locking SQLite
                    id_list = list(ids_to_delete)
                    chunk_size = 500
                    for i in range(0, len(id_list), chunk_size):
                        chunk = id_list[i:i + chunk_size]
                        del_stmt = delete(EventLog).where(EventLog.id.in_(chunk))
                        session.exec(del_stmt)
                        session.commit()
                        deleted_rows += len(chunk)
                        
                logger.info(f"Purged {deleted_rows} logs and {deleted_files} snapshot files.")
            except Exception as e:
                session.rollback()
                logger.error(f"Error during purge_old_logs: {e}")
                errors.append(str(e))
                
        return {
            "deleted_rows": deleted_rows,
            "deleted_files": deleted_files,
            "errors": errors
        }

    def get_db_stats(self, project_id: str = None) -> Dict[str, Any]:
        """Returns database size, record counts, and snapshot disk usage."""
        stats = {}
        try:
            db_file = Path(self.db_path)
            stats["db_file_size_bytes"] = db_file.stat().st_size if db_file.exists() else 0
            stats["db_file_size_mb"] = round(stats["db_file_size_bytes"] / (1024 * 1024), 2)
            
            tel_file = Path(self.db_path_telemetry)
            stats["telemetry_file_size_bytes"] = tel_file.stat().st_size if tel_file.exists() else 0
            stats["telemetry_file_size_mb"] = round(stats["telemetry_file_size_bytes"] / (1024 * 1024), 2)
            
            wal_file = Path(f"{self.db_path}-wal")
            tel_wal_file = Path(f"{self.db_path_telemetry}-wal")
            wal_size = (wal_file.stat().st_size if wal_file.exists() else 0) + (tel_wal_file.stat().st_size if tel_wal_file.exists() else 0)
            stats["wal_file_size_bytes"] = wal_size
            stats["wal_file_size_mb"] = round(wal_size / (1024 * 1024), 2)
            
            # Disk Usage
            import shutil
            total, used, free = shutil.disk_usage("/")
            stats["disk_total_gb"] = round(total / (1024**3), 2)
            stats["disk_used_gb"] = round(used / (1024**3), 2)
            stats["disk_free_gb"] = round(free / (1024**3), 2)
            stats["disk_usage_percent"] = round((used / total) * 100, 1) if total > 0 else 0
            
            # Queue Health
            stats["log_queue_size"] = self.log_queue.qsize()
            stats["log_queue_max"] = self.log_queue.maxsize

            with Session(self.engine_telemetry) as session:
                if project_id:
                    stats["total_event_logs"] = session.exec(select(func.count(EventLog.id)).where(EventLog.project_id == project_id)).one()
                    stats["total_metrics"] = session.exec(select(func.count(SystemMetric.id)).where(SystemMetric.project_id == project_id)).one()
                    stats["total_class_counts"] = session.exec(select(func.count(ClassCountSummary.id)).where(ClassCountSummary.project_id == project_id)).one()
                    stats["total_hourly_rollups"] = session.exec(select(func.count(ClassCountHourly.id)).where(ClassCountHourly.project_id == project_id)).one()
                else:
                    stats["total_event_logs"] = session.exec(select(func.count(EventLog.id))).one()
                    stats["total_metrics"] = session.exec(select(func.count(SystemMetric.id))).one()
                    stats["total_class_counts"] = session.exec(select(func.count(ClassCountSummary.id))).one()
                    stats["total_hourly_rollups"] = session.exec(select(func.count(ClassCountHourly.id))).one()
                    
            with Session(self.engine) as session:
                if not project_id:
                    stats["total_projects"] = session.exec(select(func.count(Project.id))).one()
                    stats["total_cameras"] = session.exec(select(func.count(Camera.id))).one()
                    stats["total_models"] = session.exec(select(func.count(AIModel.id))).one()
                
            snap_count = 0
            snap_size = 0
            
            if project_id:
                with Session(self.engine_telemetry) as session:
                    snapshot_paths = session.exec(select(EventLog.snapshot_path).where(EventLog.project_id == project_id, EventLog.snapshot_path != None)).all()
                    for p in snapshot_paths:
                        f = Path(p)
                        if f.exists() and f.is_file():
                            snap_count += 1
                            snap_size += f.stat().st_size
            else:
                snapshot_dir = Path(__file__).resolve().parent.parent.parent / "snapshots"
                if snapshot_dir.exists() and snapshot_dir.is_dir():
                    for f in snapshot_dir.iterdir():
                        if f.is_file():
                            snap_count += 1
                            snap_size += f.stat().st_size
                        
            stats["snapshot_count"] = snap_count
            stats["snapshot_size_bytes"] = snap_size
            stats["snapshot_size_mb"] = round(snap_size / (1024 * 1024), 2)
            
        except Exception as e:
            logger.error(f"Error getting DB stats: {e}")
            stats["error"] = str(e)
            
        return stats

    def log_custom_metric(self, project_id: str, node_id: str, variable_name: str, value: float):
        """Asynchronously log a custom numeric metric to SQLite."""
        try:
            self.log_queue.put_nowait({
                'table': 'custom_metric_log',
                'data': {
                    'timestamp': datetime.now(timezone.utc),
                    'project_id': project_id,
                    'node_id': node_id,
                    'variable_name': variable_name,
                    'value': float(value)
                }
            })
        except Full:
            logger.warning("Database log_queue full, dropping custom metric log")

    def log_collection_record(self, project_id: str, collection_id: str, data: Dict[str, Any]) -> None:
        """Queue a Collection Writer row for the batched background writer."""
        try:
            self.log_queue.put_nowait({
                'table': 'collection_records',
                'project_id': project_id,
                'collection_id': collection_id,
                'timestamp': datetime.now(timezone.utc),
                'data_json': json.dumps(data, default=str),
            })
        except Full:
            logger.warning("Database log_queue full, dropping collection record for %s", collection_id)

    def clear_project_logs(self, project_id: str) -> Dict[str, Any]:
        """Deletes all event logs, metrics, and associated snapshot files for a specific project."""
        deleted_rows = 0
        deleted_files = 0
        
        with Session(self.engine_telemetry) as session:
            # 1. Get snapshot paths first
            statement = select(EventLog.snapshot_path).where(EventLog.project_id == project_id).where(EventLog.snapshot_path != None)
            snapshot_paths = session.exec(statement).all()
            
            # 2. Count rows to be deleted
            count_statement = select(func.count(EventLog.id)).where(EventLog.project_id == project_id)
            deleted_rows = session.exec(count_statement).one()
            
            # 3. Delete the actual rows in the DB
            session.exec(delete(EventLog).where(EventLog.project_id == project_id))
            session.exec(delete(CustomMetricLog).where(CustomMetricLog.project_id == project_id))
            
            session.commit()
            
            # 4. Delete files on disk
            for spath in snapshot_paths:
                try:
                    p = Path(spath)
                    if p.exists() and p.is_file():
                        p.unlink()
                        deleted_files += 1
                except Exception as e:
                    logger.error(f"Failed to delete snapshot file {spath}: {e}")
                    
        return {"status": "success", "deleted_rows": deleted_rows, "deleted_files": deleted_files}

    def stop(self):
        self.running = False
        self.log_queue.put(None)
        self.writer_thread.join(timeout=3.0)

# Global instance
db = DatabaseManager()

def get_db():
    from sqlmodel import Session
    with Session(db.engine) as session:
        yield session

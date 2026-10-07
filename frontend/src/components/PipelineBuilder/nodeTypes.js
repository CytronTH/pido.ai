import React, { memo } from 'react';
import InputNode from './nodes/InputNode';
import AINode from './nodes/AINode';
import LogicNode from './nodes/LogicNode';
import RateLimitNode from './nodes/RateLimitNode';
import DashboardVideoNode from './nodes/DashboardVideoNode';
import DashboardMetricNode from './nodes/DashboardMetricNode';
import DashboardTextNode from './nodes/DashboardTextNode';
import DashboardChartNode from './nodes/DashboardChartNode';
import DebugNode from './nodes/DebugNode';
import DebugOutputNode from './nodes/DebugOutputNode';
import FunctionNode from './nodes/FunctionNode';
import CounterNode from './nodes/CounterNode';
import FlowCounterNode from './nodes/FlowCounterNode';
import SnapshotNode from './nodes/SnapshotNode';
import TargetTrackerNode from './nodes/TargetTrackerNode';
import DatabaseWriterNode from './nodes/DatabaseWriterNode';
import CollectionWriterNode from './nodes/CollectionWriterNode';
import UnitThroughputNode from './nodes/UnitThroughputNode';
import ButtonEdge from './edges/ButtonEdge';

export const DEFAULT_NODE_NAMES = {
  inputNode: 'Input Source',
  aiNode: 'AI Model',
  logicNode: 'Logic Filter',
  actionNode: 'Action / Alert',
  functionNode: 'Function',
  transformNode: 'Transform',
  rateLimitNode: 'Rate Limit',
  counterNode: 'Event Counter',
  flowCounterNode: 'Flow Counter',
  unitThroughputNode: 'Unit Throughput',
  targetTrackerNode: 'Target Tracker',
  forkliftZoneNode: 'Forklift Safety Monitor',
  shelfSlotMonitorNode: 'Shelf Slot Monitor',
  snapshotNode: 'Snapshot',
  databaseWriterNode: 'Database Writer',
  collectionWriterNode: 'Collection Writer',
  dashboardChartNode: 'Chart',
  dashboardLogNode: 'Dashboard Log',
  dashboardMetricNode: 'Number / Metric',
  dashboardTextNode: 'Text Value',
  dashboardVideoNode: 'Video Stream',
  debugNode: 'Debug node',
  debugOutputNode: 'Debug Output',
  digitalInputNode: 'Digital Input',
  digitalOutputNode: 'Digital Output',
  buzzerNode: 'Active Buzzer',
  ledNode: 'LED Driver',
  rs485Node: 'RS485 Modbus',
};

export const edgeTypes = {
  buttonEdge: memo(ButtonEdge),
};

export const nodeTypes = {
  inputNode: memo(InputNode),
  aiNode: memo(AINode),
  logicNode: memo(LogicNode),
  dashboardVideoNode: memo(DashboardVideoNode),
  dashboardMetricNode: memo(DashboardMetricNode),
  dashboardTextNode: memo(DashboardTextNode),
  dashboardChartNode: memo(DashboardChartNode),
  debugNode: memo(DebugNode),
  debugOutputNode: memo(DebugOutputNode),
  functionNode: memo(FunctionNode),
  rateLimitNode: memo(RateLimitNode),
  counterNode: memo(CounterNode),
  flowCounterNode: memo(FlowCounterNode),
  snapshotNode: memo(SnapshotNode),
  targetTrackerNode: memo(TargetTrackerNode),
  databaseWriterNode: memo(DatabaseWriterNode),
  collectionWriterNode: memo(CollectionWriterNode),
  unitThroughputNode: memo(UnitThroughputNode),
};


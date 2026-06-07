import { createFrameworkState } from '../../framework/state.js';

export const state = {
  ...createFrameworkState(),
  bins: [],
  activeComponent: null,
  componentQueue: [],
  components: [],
  score: 0,
  sortedTotal: 0,
  correctDrops: {},
  _onUiChange: null,
  _spawnTimer: null,
};
export const BINS = [
    { id: 'battery',   label: 'Battery',        color: '#e74c3c' },
    { id: 'pcb',       label: 'Circuit Board',  color: '#2ecc71' },
    { id: 'plastic',   label: 'Plastic / Glass', color: '#3498db' },
    { id: 'metal',     label: 'Rare Metals',    color: '#f39c12' },
    { id: 'hazardous', label: 'Hazardous',      color: '#9b59b6' },
  ];
  
  export const COMPONENTS = [
    { id: 'battery',   label: 'Battery',         bin: 'battery',   color: '#c0392b' },
    { id: 'screen',    label: 'Screen',          bin: 'plastic',   color: '#85c1e9' },
    { id: 'pcb',       label: 'Circuit Board',   bin: 'pcb',       color: '#1e8449' },
    { id: 'casing',    label: 'Casing',          bin: 'plastic',   color: '#aab7b8' },
    { id: 'camera',    label: 'Camera Module',   bin: 'metal',     color: '#7d6608' },
    { id: 'speaker',   label: 'Speaker',         bin: 'metal',     color: '#6c3483' },
    { id: 'sim',       label: 'SIM Tray',        bin: 'metal',     color: '#d4ac0d' },
    { id: 'battery_ic', label: 'Battery IC',     bin: 'hazardous', color: '#943126' },
  ];
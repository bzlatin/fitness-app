export type EquipmentItem = {
  id: string;
  label: string;
};

export type EquipmentCategory = {
  id: string;
  title: string;
  items: EquipmentItem[];
};

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  {
    id: 'small_weights',
    title: 'Small Weights',
    items: [
      { id: 'dumbbells', label: 'Dumbbells' },
      { id: 'kettlebells', label: 'Kettlebells' },
      { id: 'medicine_ball', label: 'Medicine Balls' },
    ],
  },
  {
    id: 'bars_plates',
    title: 'Bars & Plates',
    items: [
      { id: 'barbells', label: 'Barbells' },
      { id: 'plates', label: 'Plates' },
      { id: 'ez_bars', label: 'EZ Bar' },
      { id: 'trap_bars', label: 'Trap Bar' },
      { id: 'landmine', label: 'Landmine' },
      { id: 'pvc_pipe', label: 'PVC Pipe' },
      { id: 'farmers_walk_handles', label: 'Farmer\'s Walk Handles' },
      { id: 'yoke', label: 'Yoke' },
    ],
  },
  {
    id: 'benches_racks',
    title: 'Benches & Racks',
    items: [
      { id: 'pull_up_bar', label: 'Pull Up Bar' },
      { id: 'flat_bench', label: 'Flat Bench' },
      { id: 'incline_bench', label: 'Incline Bench' },
      { id: 'decline_bench', label: 'Decline Bench' },
      { id: 'vertical_bench', label: 'Vertical Bench (Vertical Knee Raise)' },
      { id: 'squat_rack', label: 'Squat Rack' },
      { id: 'power_rack', label: 'Power Rack' },
      { id: 'reverse_hyper_bench', label: 'Reverse Hyper Bench' },
      { id: 'preacher_curl_bench', label: 'Preacher Curl Bench' },
      { id: 'back_extension_bench', label: 'Back Extension Bench' },
      { id: 'glute_ham_raise_bench', label: 'Glute Ham Raise Bench' },
      { id: 'dip_bar', label: 'Dip (Parallel) Bar' },
    ],
  },
  {
    id: 'cardio_machines',
    title: 'Cardio Machines',
    items: [
      { id: 'treadmill', label: 'Treadmill' },
      { id: 'elliptical', label: 'Elliptical' },
      { id: 'stationary_bike', label: 'Stationary Bike' },
      { id: 'rowing_machine', label: 'Rowing Machine' },
      { id: 'stair_climber', label: 'Stair Climber' },
      { id: 'ski_erg', label: 'SkiErg' },
      { id: 'assault_bike', label: 'Assault Bike' },
    ],
  },
  {
    id: 'cable_machines',
    title: 'Cable Machines',
    items: [
      { id: 'cable_crossover', label: 'Crossover Cable' },
      { id: 'lat_pulldown', label: 'Lat Pulldown Cable' },
      { id: 'cable_row', label: 'Row Cable' },
      { id: 'hi_lo_pulley_cable', label: 'Hi-Lo Pulley Cable' },
      { id: 'rope_cable', label: 'Rope Cable' },
    ],
  },
  {
    id: 'resistance_bands',
    title: 'Resistance Bands',
    items: [
      { id: 'handle_bands', label: 'Handle Bands' },
      { id: 'mini_loop_bands', label: 'Mini Loop Bands' },
      { id: 'loop_bands', label: 'Loop Bands' },
      { id: 'resistance_tubes', label: 'Resistance Tubes' },
    ],
  },
  {
    id: 'exercise_balls',
    title: 'Exercise Balls & Accessories',
    items: [
      { id: 'bosu_balance_trainer', label: 'BOSU Balance Trainer' },
      { id: 'stability_ball', label: 'Stability / Swiss Ball' },
      { id: 'foam_roller', label: 'Foam Roller' },
      { id: 'parallette_bars', label: 'Parallette Bars' },
      { id: 'ab_wheel', label: 'Ab Wheel' },
      { id: 'tire', label: 'Tire' },
      { id: 'box', label: 'Box' },
      { id: 'sled', label: 'Sled' },
      { id: 'cone', label: 'Cone' },
      { id: 'platforms', label: 'Platforms' },
    ],
  },
  {
    id: 'plate_loaded',
    title: 'Plated Machines',
    items: [
      { id: 'leg_press', label: 'Leg Press' },
      { id: 'smith_machine', label: 'Smith Machine' },
      { id: 'hammer_strength_machine', label: 'Hammer Strength Machine' },
      { id: 't_bar', label: 'T-Bar' },
      { id: 'hack_squat', label: 'Hack Squat Machine' },
      { id: 'chest_press', label: 'Chest Press Machine' },
    ],
  },
  {
    id: 'weight_machines',
    title: 'Weight Machines (Plate-loaded or pin-loaded machines)',
    items: [
      { id: 'ab_crunch_machine', label: 'Ab Crunch Machine' },
      { id: 'preacher_curl_machine', label: 'Preacher Curl Machine' },
      { id: 'bicep_curl_machine', label: 'Bicep Curl Machine' },
      { id: 'bench_press_machine', label: 'Bench Press Machine' },
      { id: 'leg_press_machine', label: 'Leg Press Machine' },
      { id: 'fly_machine', label: 'Fly Machine' },
      { id: 'leg_extension', label: 'Leg Extension Machine' },
      { id: 'leg_curl_machine', label: 'Leg Curl Machine' },
      { id: 'shoulder_shrug_machine', label: 'Shoulder Shrug Machine' },
      { id: 'back_extension_machine', label: 'Back Extension Machine' },
      { id: 'squat_machine', label: 'Squat Machine' },
      { id: 'glute_kickback_machine', label: 'Glute Kickback Machine' },
      { id: 'freemotion_machine', label: 'Freemotion Machine (All Forms)' },
      { id: 'row_machine', label: 'Row Machine' },
      { id: 'triceps_extension_machine', label: 'Triceps Extension Machine' },
      { id: 'shoulder_press_machine', label: 'Shoulder Press Machine' },
      { id: 'tricep_dip_machine', label: 'Tricep Dip Machine' },
      { id: 'thigh_adductor_machine', label: 'Thigh Adductor Machine' },
      { id: 'thigh_abductor_machine', label: 'Thigh Abductor Machine' },
      { id: 'assisted_weight_machine', label: 'Assisted Weight Machine' },
      { id: 'calf_raise_machine', label: 'Calf Raise Machine' },
      { id: 'pec_deck', label: 'Pec Deck' },
    ],
  },
  {
    id: 'rope_suspension',
    title: 'Rope & Suspension',
    items: [
      { id: 'trx', label: 'TRX' },
      { id: 'battle_ropes', label: 'Battle Ropes' },
      { id: 'rings', label: 'Rings' },
      { id: 'rope', label: 'Rope' },
      { id: 'suspension_trainer', label: 'Suspension Trainer' },
    ],
  },
];

export const ALL_EQUIPMENT = EQUIPMENT_CATEGORIES.flatMap((category) =>
  category.items.map((item) => item.id)
);

export const HOME_PRESET_EQUIPMENT = [
  'dumbbells',
  'kettlebells',
  'barbells',
  'flat_bench',
  'incline_bench',
  'squat_rack',
  'power_rack',
  'loop_bands',
  'resistance_tubes',
  'stability_ball',
  'foam_roller',
  'medicine_ball',
];

export const COMMERCIAL_PRESET_EQUIPMENT = ALL_EQUIPMENT;

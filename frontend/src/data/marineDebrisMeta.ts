/**
 * Metadata for the SIH26057 synthetic marine-debris demonstration dataset (2400 records, 12
 * classes) ported from SIH26057_Marine_Debris_3D_GEOENABLED_Dashboard_v8.html so the "3D Models"
 * page can reproduce that dashboard's gallery/modal exactly. This dataset is entirely synthetic -
 * every field is a generated demonstration value, not a measurement from this app's real
 * detection pipeline (see pages/ResultsPage.tsx / ObjectIdentificationDialog for that).
 */

export interface SyntheticRecord {
  record_id: string
  class_id: string
  class_name: string
  category: string
  data_type: string
  split: string
  dataset_version: string
  region: string
  basin: string
  latitude_deg: number
  longitude_deg: number
  water_depth_m: number
  seabed_type: string
  sonar_frequency_khz: number
  range_scale_m: number
  towfish_altitude_m: number
  slant_range_m: number
  pixel_resolution_cm: number
  orientation_deg: number
  track_heading_deg: number
  cross_track_m: number
  insonification_angle_deg: number
  background_backscatter_db: number
  target_backscatter_db: number
  target_contrast_db: number
  target_length_m: number
  target_width_m: number
  target_height_m: number
  aspect_ratio: number
  relief_m: number
  shadow_length_m: number
  shadow_width_m: number
  shadow_target_ratio: number
  burial_pct: number
  surface_roughness_mm: number
  fragmentation_score: number
  texture_variance: number
  edge_regularity: number
  object_count_in_scene: number
  visibility_score: number
  detection_difficulty: number
  label_confidence: number
  visual_signature: string
  support_count: number | null
  net_area_m2: number | null
  mesh_size_mm: number | null
  rock_roundness: number | null
  vegetation_patch_area_m2: number | null
  vegetation_height_m: number | null
  [key: string]: string | number | null
}

export const CLASSES = [
  'Plane',
  'Ship',
  'Pipe',
  'Mine',
  'Tire',
  'Mound',
  'Platform',
  'Mannequin',
  'Sea Grass',
  'Mud',
  'Rock',
  'Ghost Net',
] as const

export type ClassName = (typeof CLASSES)[number]

export const MODEL_COLORS: Record<ClassName, string> = {
  Plane: '#00E5FF',
  Ship: '#4DA3FF',
  Pipe: '#B67CFF',
  Mine: '#FF5D73',
  Tire: '#FF4ECD',
  Mound: '#FFD166',
  Platform: '#00F5A0',
  Mannequin: '#F59E0B',
  'Sea Grass': '#66FF9A',
  Mud: '#8B9BB7',
  Rock: '#C7B7A3',
  'Ghost Net': '#A78BFA',
}

/** Short, plain morphology sentence - shown in the detail modal's "Rendered morphology" section. */
export const MORPH: Record<ClassName, string> = {
  Plane: 'Fuselage with symmetric wings, tail assembly and engine pods',
  Ship: 'Elongated hull with deck and raised superstructure',
  Pipe: 'Continuous cylindrical body with end fittings',
  Mine: 'Compact regular body with protruding elements',
  Tire: 'Thick torus with central opening and tread accents',
  Mound: 'Broad low-relief raised seabed feature',
  Platform: 'Elevated engineered deck with repeated support legs',
  Mannequin: 'Head, torso, bilateral arms and legs',
  'Sea Grass': 'Vegetation patch with repeated flexible blades',
  Mud: 'Low-relief depositional seabed plane',
  Rock: 'Irregular faceted hard relief',
  'Ghost Net': 'Flexible mesh field with repeated openings and sagging strands',
}

/** Richer morphology sentence - shown under each gallery card. */
export const MORPH3D: Record<ClassName, string> = {
  Plane: 'Large flat fuselage-and-wing wreck form with tail structure and hard-surface acoustic response.',
  Ship: 'Elongated hull with raised deck, superstructure and high-relief structural elements.',
  Pipe: 'Long continuous cylindrical body with repeated linear geometry and exposed end sections.',
  Mine: 'Compact regular submerged body with radial protrusions and a pronounced target-shadow pair.',
  Tire: 'Ring-shaped elastic body with hollow center, deformation and raised tread-like geometry.',
  Mound: 'Broad natural elevation with irregular slope, sediment texture and low geometric regularity.',
  Platform: 'Engineered elevated deck with repeated vertical supports and strong rectilinear edges.',
  Mannequin: 'Human-like body reconstruction with head, torso and articulated limbs lying on the seabed.',
  'Sea Grass': 'Irregular biological vegetation patch with many slender blades and soft boundaries.',
  Mud: 'Smooth low-relief sediment surface with weak texture and diffuse acoustic appearance.',
  Rock: 'Irregular faceted hard relief with uneven edges, local peaks and strong shadowing.',
  'Ghost Net': 'Flexible tangled mesh volume with intersecting strands, sagging sections and open gaps.',
}

export const CUES: Record<ClassName, string[]> = {
  Plane: ['hard metallic body', 'strong highlight', 'directional acoustic shadow', 'fragmented wreck variation'],
  Ship: ['hard hull return', 'raised structures', 'long shadow', 'debris-field context'],
  Pipe: ['linear continuity', 'cylindrical profile', 'narrow shadow', 'burial transition'],
  Mine: ['compact target', 'regular geometry', 'target-shadow pair', 'isolated context'],
  Tire: ['central opening', 'circular wall', 'orientation/deformation', 'short-to-moderate shadow'],
  Mound: ['broad footprint', 'gradual relief', 'natural boundary', 'terrain-generated shadow'],
  Platform: ['engineered edges', 'deck plane', 'support repetition', 'high-relief shadow'],
  Mannequin: ['human silhouette', 'separated limbs', 'clothing-like body surface', 'seabed contact'],
  'Sea Grass': ['patch texture', 'soft boundary', 'repeated blades', 'heterogeneous return'],
  Mud: ['smooth surface', 'low relief', 'weak texture', 'diffuse return'],
  Rock: ['hard relief', 'irregular boundary', 'rough surface', 'local shadow'],
  'Ghost Net': ['thin strands', 'mesh openings', 'folds/sagging', 'entanglement/attachment'],
}

export interface RealWreck {
  name: string
  lat: number
  lon: number
  depth_ft: number
  length_ft: number
  beam_ft: number
}

/** NOAA Thunder Bay National Marine Sanctuary - verified real shipwreck reference positions. */
export const REAL_WRECKS: RealWreck[] = [
  { name: 'Shamrock', lat: 45.05128333333333, lon: -83.4342, depth_ft: 11, length_ft: 146, beam_ft: 30 },
  { name: 'Bay City', lat: 45.05615, lon: -83.42675, depth_ft: 11, length_ft: 146, beam_ft: 29 },
  { name: 'Monohansett', lat: 45.03326666666667, lon: -83.1998, depth_ft: 18, length_ft: 160, beam_ft: 30 },
  { name: 'New Orleans', lat: 45.04298333333333, lon: -83.24041666666666, depth_ft: 15, length_ft: 130, beam_ft: 27 },
  { name: 'O.E. Parks', lat: 45.0519, lon: -83.17545, depth_ft: 62, length_ft: 134, beam_ft: 28 },
  { name: 'W.P. Thew', lat: 45.04508333333333, lon: -83.15341666666667, depth_ft: 84, length_ft: 132, beam_ft: 24 },
  { name: 'Portland', lat: 45.24881666666667, lon: -83.4075, depth_ft: 6, length_ft: 150, beam_ft: 24 },
  { name: 'Portsmouth', lat: 45.197833333333335, lon: -83.33383333333333, depth_ft: 8, length_ft: 182, beam_ft: 27 },
  { name: 'Montana', lat: 44.98375, lon: -83.26688333333334, depth_ft: 63, length_ft: 236, beam_ft: 36 },
  { name: 'Galena', lat: 45.007666666666665, lon: -83.24983333333333, depth_ft: 16, length_ft: 190, beam_ft: 30 },
  { name: 'Defiance', lat: 45.2343, lon: -83.27845, depth_ft: 185, length_ft: 115, beam_ft: 26 },
  { name: 'Typo', lat: 44.99133333333333, lon: -83.03715, depth_ft: 195, length_ft: 137, beam_ft: 26 },
  { name: 'Monrovia', lat: 44.983666666666664, lon: -82.923, depth_ft: 140, length_ft: 448, beam_ft: 56 },
  { name: 'Pewabic', lat: 44.96483333333333, lon: -83.10393333333333, depth_ft: 165, length_ft: 200, beam_ft: 31 },
  { name: 'Viator', lat: 44.99133333333333, lon: -83.03715, depth_ft: 188, length_ft: 232, beam_ft: 33 },
  { name: 'Ishpeming', lat: 44.80981666666667, lon: -83.2775, depth_ft: 12, length_ft: 157, beam_ft: 26 },
  { name: 'American Union', lat: 45.35686666666667, lon: -83.58946666666667, depth_ft: 10, length_ft: 185, beam_ft: 25 },
]

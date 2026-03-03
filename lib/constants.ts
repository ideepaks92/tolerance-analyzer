export interface ManufacturingProcess {
  id: string;
  name: string;
  defaultTol: number; // mm, symmetric ± value
  description: string;
}

export const MANUFACTURING_PROCESSES: ManufacturingProcess[] = [
  {
    id: "cnc_milling",
    name: "CNC Milling",
    defaultTol: 0.025,
    description: "±0.025 mm typical for general features",
  },
  {
    id: "cnc_lathe",
    name: "CNC Lathe",
    defaultTol: 0.025,
    description: "±0.025 mm typical for turned features",
  },
  {
    id: "injection_molding",
    name: "Injection Molding",
    defaultTol: 0.1,
    description: "±0.100 mm typical for standard resins",
  },
  {
    id: "elastomer_overmold",
    name: "Elastomer Overmold",
    defaultTol: 0.25,
    description: "±0.250 mm typical due to material shrinkage variation",
  },
  {
    id: "metal_extrusion",
    name: "Metal Extrusion",
    defaultTol: 0.125,
    description: "±0.125 mm typical for standard profiles",
  },
  {
    id: "metal_casting",
    name: "Metal Casting",
    defaultTol: 0.4,
    description: "±0.400 mm typical for investment / die casting",
  },
  {
    id: "casting_cnc",
    name: "Casting + Post CNC",
    defaultTol: 0.05,
    description: "±0.050 mm — casting with CNC post-machining",
  },
  {
    id: "fdm_3d_print",
    name: "3D Print (FDM)",
    defaultTol: 0.2,
    description: "±0.200 mm typical for FDM/FFF (e.g. Bambu Lab, 0.4 mm nozzle)",
  },
  {
    id: "custom",
    name: "Custom",
    defaultTol: 0.05,
    description: "User-defined tolerance",
  },
];

export function getProcessById(id: string): ManufacturingProcess | undefined {
  return MANUFACTURING_PROCESSES.find((p) => p.id === id);
}

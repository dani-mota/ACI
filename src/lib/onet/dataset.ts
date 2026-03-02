// Curated O*NET occupation dataset for ACI Role Builder
// Covers manufacturing, engineering, and technical trade occupations
// Importance scores are on a 0–100 scale (O*NET 1–5 × 20)
// Source: O*NET 28.2 Database (onetcenter.org)

export interface OnetAbility {
  id: string;    // O*NET element ID
  name: string;
  importance: number; // 0–100
  level: number;      // 0–100
}

export interface OnetSkill {
  id: string;
  name: string;
  importance: number;
  level: number;
}

export interface OnetWorkStyle {
  id: string;
  name: string;
  importance: number;
}

export interface OnetOccupation {
  soc: string;       // SOC code e.g. "51-4041.00"
  title: string;
  jobZone: 1 | 2 | 3 | 4 | 5;
  abilities: OnetAbility[];
  skills: OnetSkill[];
  workStyles: OnetWorkStyle[];
  keywords: string[]; // searchable terms derived from title + common synonyms
}

export const ONET_OCCUPATIONS: OnetOccupation[] = [
  // ── 51-xxxx PRODUCTION OCCUPATIONS ───────────────────────────────────
  {
    soc: "51-4041.00", title: "Machinists", jobZone: 3,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 62, level: 54 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 66, level: 56 },
      { id: "1.A.1.c.3", name: "Number Facility",        importance: 58, level: 52 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 72, level: 62 },
      { id: "1.A.2.b.1", name: "Spatial Orientation",    importance: 64, level: 56 },
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 60, level: 52 },
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 58, level: 50 },
    ],
    skills: [
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 70, level: 60 },
      { id: "2.B.3.l", name: "Repairing",                importance: 56, level: 48 },
      { id: "2.A.1.e", name: "Mathematics",              importance: 62, level: 54 },
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 68, level: 58 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 84 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 82 },
      { id: "1.C.5.c", name: "Integrity",                importance: 74 },
      { id: "1.C.4.b", name: "Adaptability/Flexibility", importance: 62 },
    ],
    keywords: ["machinist", "cnc", "manual lathe", "milling", "turning", "metal cutting", "precision machining", "tool and die"],
  },
  {
    soc: "51-4011.00", title: "CNC Tool Programmers, Metal and Plastic", jobZone: 3,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 68, level: 60 },
      { id: "1.A.1.b.4", name: "Deductive Reasoning",   importance: 66, level: 58 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 72, level: 64 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 76, level: 68 },
      { id: "1.A.2.b.1", name: "Spatial Orientation",    importance: 70, level: 62 },
      { id: "1.A.1.c.3", name: "Number Facility",        importance: 64, level: 56 },
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 60, level: 52 },
    ],
    skills: [
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 72, level: 64 },
      { id: "2.A.1.e", name: "Mathematics",              importance: 74, level: 66 },
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 70, level: 62 },
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 66, level: 58 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 82 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 86 },
      { id: "1.C.4.b", name: "Adaptability/Flexibility", importance: 66 },
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 74 },
    ],
    keywords: ["cnc programmer", "cam programmer", "g-code", "mastercam", "siemens nx", "solidcam", "fanuc", "haas", "tool path"],
  },
  {
    soc: "51-4012.00", title: "CNC Tool Operators, Metal and Plastic", jobZone: 2,
    abilities: [
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 68, level: 58 },
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 66, level: 56 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 60, level: 50 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 56, level: 46 },
    ],
    skills: [
      { id: "2.B.3.h", name: "Operation Monitoring",     importance: 72, level: 62 },
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 62, level: 52 },
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 66, level: 56 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 88 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 84 },
      { id: "1.C.5.c", name: "Integrity",                importance: 70 },
    ],
    keywords: ["cnc operator", "machine operator", "lathe operator", "mill operator", "production machining"],
  },
  {
    soc: "51-4121.00", title: "Welders, Cutters, Solderers, and Brazers", jobZone: 2,
    abilities: [
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 66, level: 56 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 64, level: 54 },
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 60, level: 50 },
    ],
    skills: [
      { id: "2.B.3.l", name: "Repairing",                importance: 58, level: 48 },
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 62, level: 52 },
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 56, level: 46 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 86 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 80 },
      { id: "1.C.5.c", name: "Integrity",                importance: 72 },
    ],
    keywords: ["welder", "welding", "tig", "mig", "stick welding", "fabrication", "structural welding", "pipe welding"],
  },
  {
    soc: "51-2041.00", title: "Structural Metal Fabricators and Fitters", jobZone: 2,
    abilities: [
      { id: "1.A.2.b.2", name: "Visualization",          importance: 68, level: 58 },
      { id: "1.A.2.b.1", name: "Spatial Orientation",    importance: 64, level: 54 },
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 60, level: 50 },
    ],
    skills: [
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 64, level: 54 },
      { id: "2.B.3.l", name: "Repairing",                importance: 56, level: 46 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 84 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 82 },
    ],
    keywords: ["fabricator", "metal fabrication", "fitter", "sheet metal", "structural steel", "assembly"],
  },
  {
    soc: "51-1011.00", title: "First-Line Supervisors of Production and Operating Workers", jobZone: 3,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 66, level: 58 },
      { id: "1.A.1.g.2", name: "Time Sharing",           importance: 70, level: 62 },
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 68, level: 60 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 68, level: 60 },
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 72, level: 64 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 88 },
      { id: "1.C.5.c", name: "Integrity",                importance: 80 },
      { id: "1.C.4.b", name: "Adaptability/Flexibility", importance: 72 },
    ],
    keywords: ["production supervisor", "floor supervisor", "line supervisor", "manufacturing supervisor", "team lead"],
  },
  {
    soc: "51-2099.00", title: "Assemblers and Fabricators, All Other", jobZone: 2,
    abilities: [
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 64, level: 54 },
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 62, level: 52 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 58, level: 48 },
    ],
    skills: [
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 64, level: 54 },
      { id: "2.B.3.h", name: "Operation Monitoring",     importance: 60, level: 50 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 88 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 84 },
    ],
    keywords: ["assembler", "assembly technician", "production worker", "line worker", "manufacturing associate"],
  },
  {
    soc: "51-9061.00", title: "Inspectors, Testers, Sorters, Samplers, and Weighers", jobZone: 2,
    abilities: [
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 74, level: 64 },
      { id: "1.A.2.a.2", name: "Flexibility of Closure", importance: 70, level: 60 },
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 72, level: 62 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 58, level: 48 },
    ],
    skills: [
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 82, level: 72 },
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 60, level: 50 },
    ],
    workStyles: [
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 90 },
      { id: "1.C.5.a", name: "Dependability",            importance: 86 },
      { id: "1.C.5.c", name: "Integrity",                importance: 80 },
    ],
    keywords: ["quality inspector", "quality control", "QC inspector", "dimensional inspection", "first article inspection", "in-process inspection"],
  },
  {
    soc: "51-9081.00", title: "Dental Laboratory Technicians", jobZone: 3,
    abilities: [
      { id: "1.A.2.b.2", name: "Visualization",          importance: 76, level: 68 },
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 72, level: 64 },
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 68, level: 60 },
    ],
    skills: [
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 72, level: 64 },
    ],
    workStyles: [
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 88 },
      { id: "1.C.5.a", name: "Dependability",            importance: 82 },
    ],
    keywords: ["lab technician", "precision technician", "clean room", "medical device assembly"],
  },
  {
    soc: "51-4031.00", title: "Cutting, Punching, and Press Machine Setters, Operators, and Tenders", jobZone: 2,
    abilities: [
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 68, level: 58 },
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 64, level: 54 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 58, level: 48 },
    ],
    skills: [
      { id: "2.B.3.h", name: "Operation Monitoring",     importance: 70, level: 60 },
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 64, level: 54 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 86 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 82 },
    ],
    keywords: ["press operator", "stamping", "punch press", "laser cutting", "plasma cutting", "sheet metal fabrication"],
  },

  // ── 17-xxxx ENGINEERING OCCUPATIONS ──────────────────────────────────
  {
    soc: "17-2112.00", title: "Industrial Engineers", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 78, level: 70 },
      { id: "1.A.1.b.4", name: "Deductive Reasoning",   importance: 76, level: 68 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 72, level: 64 },
      { id: "1.A.1.g.2", name: "Time Sharing",           importance: 68, level: 60 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 70, level: 62 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 80, level: 72 },
      { id: "2.B.2.e", name: "Systems Analysis",         importance: 78, level: 70 },
      { id: "2.B.2.f", name: "Systems Evaluation",       importance: 74, level: 66 },
      { id: "2.A.1.e", name: "Mathematics",              importance: 70, level: 62 },
      { id: "2.A.2.a", name: "Active Learning",          importance: 72, level: 64 },
    ],
    workStyles: [
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 84 },
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 86 },
      { id: "1.C.4.b", name: "Adaptability/Flexibility", importance: 74 },
      { id: "1.C.5.c", name: "Integrity",                importance: 76 },
    ],
    keywords: ["industrial engineer", "manufacturing engineer", "process engineer", "lean", "six sigma", "efficiency", "operations engineering"],
  },
  {
    soc: "17-2141.00", title: "Mechanical Engineers", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 78, level: 70 },
      { id: "1.A.1.b.4", name: "Deductive Reasoning",   importance: 76, level: 68 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 80, level: 72 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 82, level: 74 },
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 74, level: 66 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 82, level: 74 },
      { id: "2.B.2.e", name: "Systems Analysis",         importance: 78, level: 70 },
      { id: "2.A.1.e", name: "Mathematics",              importance: 80, level: 72 },
      { id: "2.A.2.a", name: "Active Learning",          importance: 74, level: 66 },
    ],
    workStyles: [
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 88 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 82 },
      { id: "1.C.4.b", name: "Adaptability/Flexibility", importance: 72 },
      { id: "1.C.5.c", name: "Integrity",                importance: 76 },
    ],
    keywords: ["mechanical engineer", "product engineer", "design engineer", "r&d engineer", "development engineer", "cad design"],
  },
  {
    soc: "17-2112.01", title: "Human Factors Engineers and Ergonomists", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 76, level: 68 },
      { id: "1.A.1.b.4", name: "Deductive Reasoning",   importance: 74, level: 66 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 66, level: 58 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 76, level: 68 },
      { id: "2.B.2.e", name: "Systems Analysis",         importance: 74, level: 66 },
    ],
    workStyles: [
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 84 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 82 },
    ],
    keywords: ["human factors engineer", "ergonomics", "usability", "safety engineer", "systems engineer"],
  },
  {
    soc: "17-2199.00", title: "Engineers, All Other", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 74, level: 66 },
      { id: "1.A.1.b.4", name: "Deductive Reasoning",   importance: 72, level: 64 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 72, level: 64 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 68, level: 60 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 78, level: 70 },
      { id: "2.B.2.e", name: "Systems Analysis",         importance: 72, level: 64 },
      { id: "2.A.2.a", name: "Active Learning",          importance: 72, level: 64 },
    ],
    workStyles: [
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 86 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 80 },
    ],
    keywords: ["engineer", "technical specialist", "process engineer", "project engineer", "manufacturing engineer"],
  },
  {
    soc: "17-2011.00", title: "Aerospace Engineers", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 80, level: 72 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 82, level: 74 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 80, level: 72 },
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 76, level: 68 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 82, level: 74 },
      { id: "2.A.1.e", name: "Mathematics",              importance: 84, level: 76 },
      { id: "2.B.2.f", name: "Systems Evaluation",       importance: 76, level: 68 },
    ],
    workStyles: [
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 90 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 86 },
      { id: "1.C.5.c", name: "Integrity",                importance: 80 },
    ],
    keywords: ["aerospace engineer", "avionics", "structures engineer", "propulsion", "flight systems", "defense engineering"],
  },
  {
    soc: "17-2131.00", title: "Materials Engineers", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 76, level: 68 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 74, level: 66 },
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 72, level: 64 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 76, level: 68 },
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 72, level: 64 },
    ],
    workStyles: [
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 86 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 84 },
    ],
    keywords: ["materials engineer", "metallurgy", "composites", "materials science", "failure analysis"],
  },
  {
    soc: "17-2071.00", title: "Electrical Engineers", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 78, level: 70 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 82, level: 74 },
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 74, level: 66 },
      { id: "1.A.2.a.2", name: "Flexibility of Closure", importance: 68, level: 60 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 80, level: 72 },
      { id: "2.A.1.e", name: "Mathematics",              importance: 82, level: 74 },
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 76, level: 68 },
    ],
    workStyles: [
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 88 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 84 },
    ],
    keywords: ["electrical engineer", "electronics engineer", "controls engineer", "PLC", "automation engineer"],
  },

  // ── 49-xxxx INSTALLATION / MAINTENANCE / REPAIR ───────────────────────
  {
    soc: "49-9071.00", title: "Maintenance and Repair Workers, General", jobZone: 2,
    abilities: [
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 68, level: 58 },
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 64, level: 54 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 62, level: 52 },
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 60, level: 50 },
    ],
    skills: [
      { id: "2.B.3.l", name: "Repairing",                importance: 74, level: 64 },
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 72, level: 62 },
      { id: "2.B.3.i", name: "Equipment Maintenance",    importance: 76, level: 66 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 84 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 78 },
    ],
    keywords: ["maintenance tech", "maintenance worker", "facilities maintenance", "general maintenance", "building maintenance"],
  },
  {
    soc: "49-2011.00", title: "Computer, Automated Teller, and Office Machine Repairers", jobZone: 3,
    abilities: [
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 70, level: 62 },
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 68, level: 60 },
      { id: "1.A.2.a.2", name: "Flexibility of Closure", importance: 64, level: 56 },
    ],
    skills: [
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 78, level: 70 },
      { id: "2.B.3.l", name: "Repairing",                importance: 74, level: 66 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 82 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 80 },
    ],
    keywords: ["equipment repair technician", "electronics repair", "field service technician"],
  },
  {
    soc: "49-9041.00", title: "Industrial Machinery Mechanics", jobZone: 3,
    abilities: [
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 72, level: 64 },
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 70, level: 62 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 66, level: 56 },
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 62, level: 52 },
    ],
    skills: [
      { id: "2.B.3.l", name: "Repairing",                importance: 80, level: 72 },
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 78, level: 70 },
      { id: "2.B.3.i", name: "Equipment Maintenance",    importance: 80, level: 72 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 86 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 80 },
    ],
    keywords: ["industrial mechanic", "plant mechanic", "equipment mechanic", "manufacturing mechanic", "machinery maintenance"],
  },
  {
    soc: "49-9043.00", title: "Maintenance Workers, Machinery", jobZone: 2,
    abilities: [
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 64, level: 54 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 60, level: 50 },
    ],
    skills: [
      { id: "2.B.3.i", name: "Equipment Maintenance",    importance: 74, level: 64 },
      { id: "2.B.3.l", name: "Repairing",                importance: 66, level: 56 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 86 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 78 },
    ],
    keywords: ["machine maintenance", "preventive maintenance", "pm technician", "lubrication tech"],
  },
  {
    soc: "49-2094.00", title: "Electrical and Electronics Repairers, Commercial and Industrial Equipment", jobZone: 3,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 72, level: 64 },
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 70, level: 62 },
      { id: "1.A.2.a.2", name: "Flexibility of Closure", importance: 66, level: 58 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 62, level: 54 },
    ],
    skills: [
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 82, level: 74 },
      { id: "2.B.3.l", name: "Repairing",                importance: 78, level: 70 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 82 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 82 },
    ],
    keywords: ["electronics repair", "electrical repair", "controls technician", "automation technician", "PLC technician"],
  },
  {
    soc: "49-9012.00", title: "Control and Valve Installers and Repairers, Except Mechanical Door", jobZone: 3,
    abilities: [
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 70, level: 62 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 66, level: 58 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 60, level: 52 },
    ],
    skills: [
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 74, level: 66 },
      { id: "2.B.3.l", name: "Repairing",                importance: 72, level: 64 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 84 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 80 },
    ],
    keywords: ["instrumentation technician", "instrument tech", "process control", "flow control", "process instrumentation"],
  },

  // ── 15-xxxx COMPUTER & MATHEMATICAL OCCUPATIONS ──────────────────────
  {
    soc: "15-1253.00", title: "Software Quality Assurance Analysts and Testers", jobZone: 3,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 72, level: 64 },
      { id: "1.A.1.b.4", name: "Deductive Reasoning",   importance: 70, level: 62 },
      { id: "1.A.2.a.2", name: "Flexibility of Closure", importance: 68, level: 60 },
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 70, level: 62 },
    ],
    skills: [
      { id: "2.B.3.k", name: "Troubleshooting",          importance: 72, level: 64 },
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 76, level: 68 },
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 70, level: 62 },
    ],
    workStyles: [
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 86 },
      { id: "1.C.5.a", name: "Dependability",            importance: 80 },
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 82 },
    ],
    keywords: ["quality assurance", "QA tester", "software tester", "test engineer", "quality engineer", "CMM", "metrology"],
  },
  {
    soc: "15-1299.08", title: "Computer Systems Engineers/Architects", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 78, level: 70 },
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 74, level: 66 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 72, level: 64 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 80, level: 72 },
      { id: "2.B.2.e", name: "Systems Analysis",         importance: 78, level: 70 },
    ],
    workStyles: [
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 88 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 82 },
    ],
    keywords: ["systems engineer", "controls engineer", "automation engineer", "embedded systems", "manufacturing IT"],
  },

  // ── QUALITY & METROLOGY ───────────────────────────────────────────────
  {
    soc: "17-2112.02", title: "Validation Engineers", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 76, level: 68 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 72, level: 64 },
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 74, level: 66 },
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 70, level: 62 },
    ],
    skills: [
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 82, level: 74 },
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 74, level: 66 },
      { id: "2.B.2.f", name: "Systems Evaluation",       importance: 76, level: 68 },
    ],
    workStyles: [
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 90 },
      { id: "1.C.5.a", name: "Dependability",            importance: 86 },
      { id: "1.C.5.c", name: "Integrity",                importance: 84 },
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 84 },
    ],
    keywords: ["validation engineer", "quality engineer", "CMM programmer", "metrology", "GD&T", "dimensional quality", "IQ OQ PQ", "calibration engineer"],
  },
  {
    soc: "17-2112.03", title: "Manufacturing Engineers", jobZone: 4,
    abilities: [
      { id: "1.A.1.b.3", name: "Inductive Reasoning",   importance: 78, level: 70 },
      { id: "1.A.1.b.4", name: "Deductive Reasoning",   importance: 74, level: 66 },
      { id: "1.A.1.c.2", name: "Mathematical Reasoning", importance: 70, level: 62 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 72, level: 64 },
      { id: "1.A.1.b.1", name: "Problem Sensitivity",   importance: 76, level: 68 },
    ],
    skills: [
      { id: "2.B.2.i", name: "Complex Problem Solving",  importance: 80, level: 72 },
      { id: "2.B.2.e", name: "Systems Analysis",         importance: 76, level: 68 },
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 72, level: 64 },
      { id: "2.A.2.a", name: "Active Learning",          importance: 70, level: 62 },
    ],
    workStyles: [
      { id: "1.C.6.a", name: "Analytical Thinking",      importance: 88 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 82 },
      { id: "1.C.4.b", name: "Adaptability/Flexibility", importance: 74 },
      { id: "1.C.5.c", name: "Integrity",                importance: 76 },
    ],
    keywords: ["manufacturing engineer", "process engineer", "production engineer", "lean manufacturing", "dfma", "design for manufacturing"],
  },
  {
    soc: "51-9199.00", title: "Production Workers, All Other", jobZone: 2,
    abilities: [
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 62, level: 52 },
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 58, level: 48 },
    ],
    skills: [
      { id: "2.B.3.h", name: "Operation Monitoring",     importance: 62, level: 52 },
    ],
    workStyles: [
      { id: "1.C.5.a", name: "Dependability",            importance: 88 },
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 80 },
    ],
    keywords: ["factory worker", "production technician", "factory technician", "production associate", "line technician", "entry level manufacturing"],
  },
  {
    soc: "51-2022.00", title: "Electrical and Electronic Equipment Assemblers", jobZone: 2,
    abilities: [
      { id: "1.A.1.g.1", name: "Selective Attention",    importance: 70, level: 60 },
      { id: "1.A.2.a.3", name: "Perceptual Speed",       importance: 68, level: 58 },
      { id: "1.A.2.b.2", name: "Visualization",          importance: 62, level: 52 },
    ],
    skills: [
      { id: "2.B.4.b", name: "Quality Control Analysis", importance: 68, level: 58 },
      { id: "2.B.3.h", name: "Operation Monitoring",     importance: 62, level: 52 },
    ],
    workStyles: [
      { id: "1.C.5.b", name: "Attention to Detail",      importance: 88 },
      { id: "1.C.5.a", name: "Dependability",            importance: 84 },
    ],
    keywords: ["electronics assembler", "PCB assembler", "harness assembly", "cable assembly", "electronic technician"],
  },
];

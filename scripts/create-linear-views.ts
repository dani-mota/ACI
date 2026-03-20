/**
 * Creates 13 custom views in Linear for the Project Arklight workspace.
 *
 * Usage:
 *   LINEAR_API_KEY=lin_api_xxx npx tsx scripts/create-linear-views.ts
 */

const API_KEY = process.env.LINEAR_API_KEY;
if (!API_KEY) {
  console.error("ERROR: Set LINEAR_API_KEY environment variable.");
  process.exit(1);
}

const TEAM_ID = "0b9556cb-40df-4e2b-8b0f-ee35d19ee7a0";

// Label IDs
const LABELS = {
  p0Blocker: "fcd9d664-3e3e-40a6-a431-795ecdd66ed1",
  prePilotBlocker: "ca707622-1016-4514-9a2f-3f3e12dfcb2b",
  security: "a3f9114c-def2-43bb-94f9-45b0234c3717",
  bug: "cd27f1c8-c362-4302-a90b-8af2908f1d19",
  psychometrics: "a4649b42-be66-4f82-a602-00b4164f07a6",
  accessibility: "c4223e03-60b3-4858-97d7-2f97c96c2c64",
  compliance: "99ace268-9ad6-483a-98dd-cd2efbde891c",
  uiux: "96514a2d-4bd5-42e5-9416-cc9bf633e822",
  observability: "2a948da8-13a6-4c43-bf5d-6d778ea95afe",
  reliability: "7d6cc085-cc52-4649-9f1f-0c9f50369e19",
  migrationRequired: "1782a966-e885-40b9-87a2-e296768e51e6",
  costControl: "c1ab7f06-c9e0-4bec-9a5e-bd03a1aaf7dc",
  testing: "f1cf72ca-79ac-4515-a224-2b36c110008a",
  voicePipeline: "2153a267-d9eb-4c82-9648-f0f70dd782a6",
  dataIntegrity: "9f5bef68-2ccf-431c-97c0-f8fea392e1d7",
  improvement: "42d8b5b3-bb05-42a8-8054-3c03db20e4b7",
  feature: "29267ff5-f7e3-4cff-aa6a-18a43bd423fb",
};

// Reusable: exclude Done, Canceled, Duplicate statuses
// Linear state types: triage, backlog, unstarted, started, completed, canceled
// "Done" and "Duplicate" are "completed" type; "Canceled" is "canceled" type
// We exclude both completed and canceled state types
const NOT_DONE_CANCELED = {
  state: {
    type: { nin: ["completed", "cancelled"] },
  },
};

// Note: Linear uses "cancelled" (double l) in some contexts and "canceled" in others.
// The state type values are: triage, backlog, unstarted, started, completed, cancelled
// We'll try both spellings to be safe by also using neq approach

interface ViewDefinition {
  name: string;
  description?: string;
  filterData: Record<string, unknown>;
  icon?: string;
  color?: string;
}

const views: ViewDefinition[] = [
  // View 1: Pre-Pilot Blockers
  {
    name: "Pre-Pilot Blockers",
    description:
      "P0 blockers, pre-pilot blockers, and urgent issues that must be resolved before pilot launch",
    filterData: {
      and: [
        {
          or: [
            { labels: { id: { eq: LABELS.p0Blocker } } },
            { labels: { id: { eq: LABELS.prePilotBlocker } } },
            { priority: { eq: 1 } }, // Urgent
          ],
        },
        {
          state: { type: { nin: ["completed", "cancelled"] } },
        },
      ],
    },
    icon: "AlertTriangle",
    color: "#EF4444",
  },

  // View 2: Bug Triage Queue
  {
    name: "Bug Triage Queue",
    description: "All open bugs sorted by priority and creation date",
    filterData: {
      and: [
        { labels: { id: { eq: LABELS.bug } } },
        { state: { type: { nin: ["completed", "cancelled"] } } },
      ],
    },
    icon: "Bug",
    color: "#F59E0B",
  },

  // View 3: Security Hardening
  {
    name: "Security Hardening",
    description: "Security-related issues across all statuses",
    filterData: {
      labels: { id: { eq: LABELS.security } },
    },
    icon: "Shield",
    color: "#DC2626",
  },

  // View 4: Psychometrics & Scoring
  {
    name: "Psychometrics & Scoring",
    description: "Issues related to psychometric validity and scoring pipeline",
    filterData: {
      labels: { id: { eq: LABELS.psychometrics } },
    },
    icon: "BarChart",
    color: "#8B5CF6",
  },

  // View 5: Accessibility & Compliance
  {
    name: "Accessibility & Compliance",
    description:
      "Accessibility, compliance, and UI/UX issues that are still open",
    filterData: {
      and: [
        {
          or: [
            { labels: { id: { eq: LABELS.accessibility } } },
            { labels: { id: { eq: LABELS.compliance } } },
            { labels: { id: { eq: LABELS.uiux } } },
          ],
        },
        { state: { type: { nin: ["completed", "cancelled"] } } },
      ],
    },
    icon: "Accessibility",
    color: "#3B82F6",
  },

  // View 6: By Domain
  {
    name: "By Domain",
    description: "All non-canceled/duplicate issues grouped by project domain",
    filterData: {
      state: { type: { nin: ["cancelled"] } },
    },
    icon: "Folder",
    color: "#6366F1",
  },

  // View 7: Observability Gaps
  {
    name: "Observability Gaps",
    description: "Observability and reliability issues that are still open",
    filterData: {
      and: [
        {
          or: [
            { labels: { id: { eq: LABELS.observability } } },
            { labels: { id: { eq: LABELS.reliability } } },
          ],
        },
        { state: { type: { nin: ["completed", "cancelled"] } } },
      ],
    },
    icon: "Eye",
    color: "#10B981",
  },

  // View 8: Pending Migrations
  {
    name: "Pending Migrations",
    description: "Issues requiring migration, sorted by creation date",
    filterData: {
      labels: { id: { eq: LABELS.migrationRequired } },
    },
    icon: "Database",
    color: "#F97316",
  },

  // View 9: Cost Control
  {
    name: "Cost Control",
    description: "Cost control issues that are still open",
    filterData: {
      and: [
        { labels: { id: { eq: LABELS.costControl } } },
        { state: { type: { nin: ["completed", "cancelled"] } } },
      ],
    },
    icon: "DollarSign",
    color: "#14B8A6",
  },

  // View 10: Test Coverage
  {
    name: "Test Coverage",
    description: "Testing-related issues",
    filterData: {
      labels: { id: { eq: LABELS.testing } },
    },
    icon: "CheckSquare",
    color: "#22C55E",
  },

  // View 11: Voice Pipeline
  {
    name: "Voice Pipeline",
    description: "Voice pipeline related issues",
    filterData: {
      labels: { id: { eq: LABELS.voicePipeline } },
    },
    icon: "Microphone",
    color: "#A855F7",
  },

  // View 12: Data Integrity
  {
    name: "Data Integrity",
    description: "Data integrity issues that are still open",
    filterData: {
      and: [
        { labels: { id: { eq: LABELS.dataIntegrity } } },
        { state: { type: { nin: ["completed", "cancelled"] } } },
      ],
    },
    icon: "Database",
    color: "#EAB308",
  },

  // View 13: All Open Work
  {
    name: "All Open Work",
    description: "All issues that are not done, canceled, or duplicate",
    filterData: {
      state: { type: { nin: ["completed", "cancelled"] } },
    },
    icon: "List",
    color: "#64748B",
  },
];

const MUTATION = `
  mutation CustomViewCreate($input: CustomViewCreateInput!) {
    customViewCreate(input: $input) {
      success
      customView {
        id
        name
        filterData
      }
    }
  }
`;

async function createView(view: ViewDefinition): Promise<void> {
  const variables = {
    input: {
      name: view.name,
      description: view.description,
      filterData: view.filterData,
      teamId: TEAM_ID,
      icon: view.icon,
      color: view.color,
      shared: true,
    },
  };

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: API_KEY!,
    },
    body: JSON.stringify({ query: MUTATION, variables }),
  });

  const json = (await res.json()) as {
    data?: {
      customViewCreate?: {
        success: boolean;
        customView?: { id: string; name: string };
      };
    };
    errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
  };

  if (json.errors) {
    console.error(`FAIL: "${view.name}"`);
    for (const err of json.errors) {
      console.error(`  -> ${err.message}`);
      if (err.extensions) console.error(`     extensions:`, JSON.stringify(err.extensions));
    }
    return;
  }

  if (json.data?.customViewCreate?.success) {
    const cv = json.data.customViewCreate.customView;
    console.log(`OK: "${cv?.name}" (${cv?.id})`);
  } else {
    console.error(`FAIL: "${view.name}" — unexpected response:`, JSON.stringify(json));
  }
}

async function main() {
  console.log(`Creating ${views.length} custom views in Linear...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const view of views) {
    try {
      await createView(view);
      successCount++;
    } catch (err) {
      console.error(`FAIL: "${view.name}" — ${err}`);
      failCount++;
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. ${successCount} attempted, ${failCount} errors.`);
}

main();

-- Add missing RLS coverage for ContentLibrary and Act2ItemAnswer.

ALTER TABLE public."ContentLibrary" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public."ContentLibrary"
  FOR ALL USING (
    "roleId" IN (
      SELECT id FROM public."Role"
      WHERE "orgId" = public.get_current_org_id()
    )
  )
  WITH CHECK (
    "roleId" IN (
      SELECT id FROM public."Role"
      WHERE "orgId" = public.get_current_org_id()
    )
  );

ALTER TABLE public."Act2ItemAnswer" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny_all" ON public."Act2ItemAnswer"
  FOR ALL USING (false)
  WITH CHECK (false);

-- Migration: add projects + project_links tables
-- Run in Supabase → SQL Editor

-- ─── projects ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name          text NOT NULL,
  status        text NOT NULL DEFAULT 'collecting'
                  CHECK (status IN ('collecting','processing','finishing','done')),
  start_date    date,
  completion_date date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Filter by client and sort by due date — both are common query patterns
CREATE INDEX IF NOT EXISTS projects_client_id_idx  ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx     ON public.projects(status);
CREATE INDEX IF NOT EXISTS projects_completion_idx ON public.projects(completion_date);

-- ─── project_links ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title      text NOT NULL,
  url        text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_links_project_id_idx ON public.project_links(project_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_links ENABLE ROW LEVEL SECURITY;

-- Staff, admin, and super_admin can read and write; clients cannot access
CREATE POLICY "staff can select projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('staff','admin','super_admin')
    )
  );

CREATE POLICY "staff can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('staff','admin','super_admin')
    )
  );

CREATE POLICY "staff can update projects"
  ON public.projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('staff','admin','super_admin')
    )
  );

CREATE POLICY "staff can delete projects"
  ON public.projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('staff','admin','super_admin')
    )
  );

CREATE POLICY "staff can select project_links"
  ON public.project_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('staff','admin','super_admin')
    )
  );

CREATE POLICY "staff can insert project_links"
  ON public.project_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('staff','admin','super_admin')
    )
  );

CREATE POLICY "staff can delete project_links"
  ON public.project_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('staff','admin','super_admin')
    )
  );

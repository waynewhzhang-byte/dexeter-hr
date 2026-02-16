create table if not exists pack_version_submission (
  id uuid primary key,
  pack_version_id uuid not null references domain_pack_version(id),
  submitted_by text not null,
  submitted_at timestamptz not null default now(),
  unique (pack_version_id)
);

create table if not exists domain_pack (
  id uuid primary key,
  pack_code text not null unique,
  name text not null,
  status text not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists domain_pack_version (
  id uuid primary key,
  pack_id uuid not null references domain_pack(id),
  version_no integer not null,
  content_json jsonb not null,
  schema_version text not null,
  change_note text,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (pack_id, version_no)
);

create table if not exists release_binding (
  id uuid primary key,
  pack_id uuid not null references domain_pack(id),
  environment text not null check (environment in ('dev', 'staging', 'prod')),
  active_version_id uuid not null references domain_pack_version(id),
  released_by text not null,
  released_at timestamptz not null default now(),
  unique (pack_id, environment)
);

create table if not exists approval_record (
  id uuid primary key,
  pack_version_id uuid not null references domain_pack_version(id),
  stage text not null check (stage in ('hr_review', 'business_review', 'security_review')),
  decision text not null check (decision in ('approved', 'rejected')),
  comment text,
  reviewer text not null,
  reviewed_at timestamptz not null default now()
);

create table if not exists config_audit_log (
  id uuid primary key,
  actor text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

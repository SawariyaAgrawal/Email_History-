-- Run this in Supabase SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.records (
  id bigint generated always as identity primary key,
  data jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  source_file text not null default '',
  row_index integer not null default 0,
  region text not null default '',
  last_visit_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communications (
  id bigint generated always as identity primary key,
  record_id bigint not null references public.records(id) on delete cascade,
  visit_date date not null,
  sales_officer_visit_date date null,
  major_minor_irregularities text not null default '',
  deviation_noticed_no text not null default '',
  deviation_noticed_date date null,
  deviation_noticed_no_and_date text not null default '',
  reply_received_by_dealer_date date null,
  reply_satisfactory_yes_no text not null default '',
  imposition_of_mdg_penalty_notice_date date null,
  reminder1_date date null,
  reminder1_reply_date date null,
  reminder2_date date null,
  reminder2_reply_date date null,
  penalty_recover_by text not null default '',
  penalty_rtgs_dd_no_and_date text not null default '',
  emi_dates text not null default '',
  transition_complete text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_id, visit_date)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_records_updated_at on public.records;
create trigger trg_records_updated_at
before update on public.records
for each row execute function public.set_updated_at();

drop trigger if exists trg_communications_updated_at on public.communications;
create trigger trg_communications_updated_at
before update on public.communications
for each row execute function public.set_updated_at();

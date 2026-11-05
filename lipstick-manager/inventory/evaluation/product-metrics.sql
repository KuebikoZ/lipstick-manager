-- Replace :environment and :from_time in the query runner. Production reports must use environment='production'.
with events as (
  select * from public.analytics_events
  where environment = :environment and occurred_at >= :from_time
), intake as (
  select intake_id,
    bool_or(event_name = 'intake_start') as started,
    bool_or(event_name = 'intake_end' and properties->>'outcome' = 'success') as completed,
    max((properties->>'adopted_count')::int) filter (where event_name = 'intake_end') as adopted,
    max((properties->>'corrected_count')::int) filter (where event_name = 'intake_end') as corrected
  from events where intake_id is not null group by intake_id
)
select
  count(*) filter (where started) as intake_started,
  count(*) filter (where completed) as intake_completed,
  round(count(*) filter (where completed)::numeric / nullif(count(*) filter (where started), 0), 4) as intake_completion_rate,
  count(*) filter (where completed and coalesce(adopted, 0) > 0) as ai_adopted_intakes,
  round(count(*) filter (where completed and coalesce(adopted, 0) > 0)::numeric / nullif(count(*) filter (where completed), 0), 4) as ai_adoption_rate,
  sum(coalesce(corrected, 0)) as ai_corrected_suggestions
from intake;

-- Function usage: page_view sessions / authenticated sessions that reached the inventory.
select page_id, count(*) as views, count(distinct session_id) as sessions
from public.analytics_events
where environment = :environment and occurred_at >= :from_time and event_name = 'page_view'
group by page_id order by page_id;

-- Filter, sort, compare and AI suggestion behavior. No card exposure or passive-detail proxy is used.
select properties->>'action' as action, count(*) as uses, count(distinct session_id) as sessions
from public.analytics_events
where environment = :environment and occurred_at >= :from_time and event_name = 'action'
group by properties->>'action' order by properties->>'action';

-- Reliability funnel, deduplicated by event_id primary key.
select event_name, properties->>'outcome' as outcome, count(*) as events, count(distinct intake_id) as intakes
from public.analytics_events
where environment = :environment and occurred_at >= :from_time
  and event_name in ('ai_result','save_result','intake_end')
group by event_name, properties->>'outcome' order by event_name, outcome;

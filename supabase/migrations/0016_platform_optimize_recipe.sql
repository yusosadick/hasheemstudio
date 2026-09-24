-- New recipe: platform_optimize — a re-encode whose bitrate ceiling is matched to the input's actual
-- display resolution and frame rate (see docs/ARCHITECTURE.md "Platform-optimize recipe" and
-- apps/worker/src/platformProfile.ts), so the file handed back is not the "same huge bitrate, just
-- repackaged" result a stream-copy remux produces.
--
-- Purely additive (expand-only per docs/MIGRATIONS.md): no existing row or value changes meaning.
-- ALTER TYPE ... ADD VALUE is permitted inside the runner's per-migration transaction on PG >= 12,
-- provided the new value is not *used* in the same transaction; plans.allowed_recipes is text[], not
-- the enum, so the entitlement update below does not use it.

alter type public.job_recipe add value if not exists 'platform_optimize';

update public.plans
   set allowed_recipes = array_append(allowed_recipes, 'platform_optimize')
 where not ('platform_optimize' = any (allowed_recipes));

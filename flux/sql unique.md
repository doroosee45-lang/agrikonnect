CHECK (
  status IS NOT NULL
  AND plot_id IS NOT NULL
  AND lab_org_id IS NOT NULL
  AND (
    (
      status = 'ACTIVE'
      AND active_key IS NOT NULL
      AND active_key = plot_id::text || ':' || lab_org_id::text
    )
    OR (
      status <> 'ACTIVE'
      AND active_key IS NULL
    )
  )
);

CREATE UNIQUE INDEX lab_mandates_one_active_per_pair_uq
  ON lab_mandates (plot_id, lab_org_id)
  WHERE status = 'ACTIVE';
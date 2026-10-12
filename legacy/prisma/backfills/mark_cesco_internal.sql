UPDATE "Organization"
SET "kind" = 'INTERNAL'
WHERE lower("name") = lower('CESCo Internal')
  AND "kind" <> 'INTERNAL';

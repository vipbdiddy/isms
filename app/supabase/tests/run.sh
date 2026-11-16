#!/usr/bin/env bash
# Tests the database rules in ../schema.sql on a local PostgreSQL (15 or newer). Nothing here touches
# the real Supabase project: supabase_stand_in.sql stands in for the parts of Supabase the schema uses.
#
# Point the usual PG* variables at a local server where you can create databases as a superuser:
#   PGHOST=/tmp PGPORT=5432 PGUSER=postgres supabase/tests/run.sh
#
# For each test_*.sh it drops and recreates a database called isms_test, loads the schema twice (the
# file has to be safe to run again), and runs the test.
cd "$(dirname "$0")" || exit 1
export PGOPTIONS='--client-min-messages=warning'
status=0
for t in test_*.sh; do
  echo "== $t"
  PGDATABASE=postgres psql -q -v ON_ERROR_STOP=1 \
    -c 'drop database if exists isms_test' -c 'create database isms_test' || exit 1
  export PGDATABASE=isms_test
  psql -q -v ON_ERROR_STOP=1 -f supabase_stand_in.sql -f ../schema.sql -f ../schema.sql > /dev/null || exit 1
  bash "$t" || status=1
done
exit $status

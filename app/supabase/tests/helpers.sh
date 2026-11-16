# Shared by the test_*.sh files: run SQL as someone signed in, or signed out, and compare results.
PSQL="psql -At -v ON_ERROR_STOP=1"
fails=0

# as <user id | anon> <sql>: what that person gets back, errors included.
as() {
  local who="$1"; shift
  if [ "$who" = anon ]; then
    $PSQL -c "set role anon; $*" 2>&1 | grep -v '^SET$'
  else
    $PSQL -c "select set_config('request.jwt.claim.sub', '$who', false); set role authenticated; $*" 2>&1 \
      | grep -v -e "^$who\$" -e '^SET$' -e '^UPDATE [0-9]*$' -e '^INSERT [0-9]* [0-9]*$' -e '^DELETE [0-9]*$' -e '^$'
  fi
}

# check <name> <expected> <actual>
check() {
  if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1   expected [$2] got [$3]"; fails=$((fails+1)); fi
}

# has <text>: that text if the input contains it, to compare an error message against.
has() { grep -o "$1" | head -1; }

# The last line of a test: the result, and the exit code run.sh reads.
finish() {
  echo
  if [ $fails -eq 0 ]; then echo "ALL PASSED"; else echo "$fails FAILED"; fi
  [ $fails -eq 0 ]
}

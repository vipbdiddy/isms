#!/usr/bin/env bash
# Pictures with quotes and stories: whoever can see a quote or story can open its picture, and nobody
# else; a picture shared with everyone waits for a reviewer, who can open it; and a quote or story can
# only use a picture its author uploaded. Run by run.sh.
cd "$(dirname "$0")" && . ./helpers.sh
A=aaaaaaaa-0000-0000-0000-000000000001   # Ann: adds the loved ones
B=bbbbbbbb-0000-0000-0000-000000000002   # Bob: Ann's friend
C=cccccccc-0000-0000-0000-000000000003   # Cat: a stranger
D=dddddddd-0000-0000-0000-000000000004   # Dan: Ann's friend, who adds to her loved ones
E=eeeeeeee-0000-0000-0000-000000000005   # Eve: a reviewer
G=99999999-0000-0000-0000-000000000007   # Gus: in Ann's family group
M=88888888-0000-0000-0000-000000000008   # Mal: a stranger who knows the path of one of Ann's pictures
FAMILY=66666666-0000-0000-0000-000000000001
opens() { as "$1" "select count(*) from storage.objects where bucket_id = 'photos' and name = '$2'"; }
upload() { as "$1" "insert into storage.objects (bucket_id, name) values ('photos', '$2')" | has 'ERROR'; }
# add <user> <loved one> <text> <visibility or null> <picture path or null>: the new quote's id, or the error
add() {
  local vis=null pic=null w=null h=null
  [ "$4" != null ] && vis="'$4'"
  [ "$5" != null ] && { pic="'$5'"; w=1200; h=900; }
  as "$1" "insert into public.isms (loved_one_id, text, visibility, picture_path, picture_width, picture_height)
           values ('$2', '$3', $vis, $pic, $w, $h) returning id"
}
status() { $PSQL -c "select review_status from public.isms where id = '$1'"; }
sees() { as "$1" "select count(*) from public.isms where id = '$2'"; }

$PSQL > /dev/null <<SQL
insert into auth.users (id, email, raw_user_meta_data) values
  ('$A', 'ann@example.com', '{"full_name": "Ann Lee"}'),
  ('$B', 'bob@example.com', '{"full_name": "Bob Stone"}'),
  ('$C', 'cat@example.com', '{"full_name": "Cat Moss"}'),
  ('$D', 'dan@example.com', '{"full_name": "Dan Hill"}'),
  ('$E', 'eve@example.com', '{"full_name": "Eve Reviewer"}'),
  ('$G', 'gus@example.com', '{"full_name": "Gus Lee"}'),
  ('$M', 'mal@example.com', '{"full_name": "Mal Lory"}');
insert into public.admins (user_id) values ('$E');
insert into public.friendships (requester, addressee, status) values ('$A', '$B', 'accepted'), ('$A', '$D', 'accepted');
insert into public.groups (id, owner_id, name) values ('$FAMILY', '$A', 'Lee family');
insert into public.group_members (group_id, user_id, status) values ('$FAMILY', '$A', 'member'), ('$FAMILY', '$G', 'member')
  on conflict do nothing;
SQL
for f in friends group private public public2 public3 later moved inherited dans report mal own; do
  [ "$f" = dans ] && upload $D $D/dans.jpg > /dev/null && continue
  [ "$f" = mal ] && upload $M $M/mal.jpg > /dev/null && continue
  upload $A $A/$f.jpg > /dev/null
done
AUNT=$(as $A "insert into public.loved_ones (name, visibility) values ('Ann Aunt', 'friends') returning id")
GRANDMA=$(as $A "insert into public.loved_ones (name, visibility) values ('Ann Grandma', 'private') returning id")

echo "-- a picture goes to whoever can see its quote, and nobody else"
FRIENDS=$(add $A $AUNT 'For my friends.' null $A/friends.jpg)
check "shared with friends, it shows straight away" "ok" "$(status $FRIENDS)"
check "her friend can open the picture" "1" "$(opens $B $A/friends.jpg)"
check "a stranger can't, signed in or out" "0|0" "$(opens $C $A/friends.jpg)|$(opens anon $A/friends.jpg)"
check "nor can someone in her group who isn't her friend" "0" "$(opens $G $A/friends.jpg)"
INGROUP=$(as $A "insert into public.isms (loved_one_id, text, visibility, group_ids, picture_path, picture_width, picture_height)
                 values ('$GRANDMA', 'For the family.', 'group', '{$FAMILY}', '$A/group.jpg', 800, 600) returning id")
check "shared with a group, someone in it can open it" "ok|1" "$(status $INGROUP)|$(opens $G $A/group.jpg)"
check "her friend who isn't in the group can't" "0" "$(opens $B $A/group.jpg)"
PRIVATE=$(add $A $GRANDMA 'Just mine.' private $A/private.jpg)
check "kept to herself, only she can open it" "1|0|0" "$(opens $A $A/private.jpg)|$(opens $B $A/private.jpg)|$(opens anon $A/private.jpg)"

echo "-- shared with everyone, it waits for a reviewer"
PUBLIC=$(add $A $GRANDMA 'For everyone.' public $A/public.jpg)
check "it waits" "pending" "$(status $PUBLIC)"
check "nobody else sees the quote or opens the picture yet" "0|0|0|0" "$(sees $C $PUBLIC)|$(opens $C $A/public.jpg)|$(opens anon $A/public.jpg)|$(opens $B $A/public.jpg)"
check "Ann still sees both" "1|1" "$(sees $A $PUBLIC)|$(opens $A $A/public.jpg)"
check "the reviewer can open the picture" "1" "$(opens $E $A/public.jpg)"
check "and finds it waiting, with its picture" "$A/public.jpg" "$(as $E "select picture_path from public.content_to_review() where item_id = '$PUBLIC'")"
check "nobody else finds anything waiting" "0" "$(as $C "select count(*) from public.content_to_review()")"
NOPIC=$(add $A $GRANDMA 'Words for everyone.' public null)
check "without a picture, a kind quote for everyone shows straight away, as before" "ok" "$(status $NOPIC)"
as $E "select public.review_content('ism', '$PUBLIC', true)" > /dev/null
check "once allowed, everyone sees the quote and opens the picture" "approved|1|1|1" "$(status $PUBLIC)|$(sees $C $PUBLIC)|$(opens $C $A/public.jpg)|$(opens anon $A/public.jpg)"
check "the reviewer no longer has a way in just for reviewing" "0" "$($PSQL -c "select public.picture_to_review('$A/public.jpg')::int")"
as $A "update public.isms set text = 'For everyone, always.' where id = '$PUBLIC'" > /dev/null
check "changing only the words keeps the allowed picture showing" "approved|1" "$(status $PUBLIC)|$(opens anon $A/public.jpg)"
as $A "update public.isms set picture_path = '$A/public2.jpg', picture_width = 640, picture_height = 480 where id = '$PUBLIC'" > /dev/null
check "a new picture waits again" "pending|0|0" "$(status $PUBLIC)|$(sees $C $PUBLIC)|$(opens anon $A/public2.jpg)"
as $A "update public.isms set picture_path = null, picture_width = null, picture_height = null where id = '$PUBLIC'" > /dev/null
check "taking the picture off shows the quote straight away" "ok|1" "$(status $PUBLIC)|$(sees $C $PUBLIC)"
as $A "update public.isms set text = 'He was a liar.', picture_path = '$A/public3.jpg', picture_width = 640, picture_height = 480 where id = '$PUBLIC'" > /dev/null
check "hurtful words wait too, picture or not" "pending" "$(status $PUBLIC)"

echo "-- a picture that comes to reach everyone waits too"
LATER=$(add $A $GRANDMA 'Friends first.' friends $A/later.jpg)
check "(shared with friends, it shows)" "ok|1" "$(status $LATER)|$(opens $B $A/later.jpg)"
as $A "update public.isms set visibility = 'public' where id = '$LATER'" > /dev/null
check "sharing it with everyone holds it" "pending|0" "$(status $LATER)|$(opens $B $A/later.jpg)"
AUNTWORDS=$(add $A $AUNT 'Just words, like Aunt.' null null)
INHERITS=$(add $A $AUNT 'Like Aunt.' null $A/inherited.jpg)
DANS=$(add $D $AUNT 'Dan remembers.' null $D/dans.jpg)
check "(like Aunt, shared with friends, both show)" "ok|ok|1|1" "$(status $INHERITS)|$(status $DANS)|$(opens $B $A/inherited.jpg)|$(opens $B $D/dans.jpg)"
check "Ann can open the picture Dan added to her aunt" "1" "$(opens $A $D/dans.jpg)"
as $A "update public.loved_ones set visibility = 'public' where id = '$AUNT'" > /dev/null
check "sharing Aunt with everyone holds the pictures that follow her, Dan's too" "pending|pending" "$(status $INHERITS)|$(status $DANS)"
check "so nobody new opens them" "0|0" "$(opens anon $A/inherited.jpg)|$(opens $C $D/dans.jpg)"
check "a quote of hers without a picture shows to everyone straight away" "ok|1" "$(status $AUNTWORDS)|$(sees anon $AUNTWORDS)"
as $A "update public.loved_ones set visibility = 'friends' where id = '$AUNT'" > /dev/null
as $E "select public.review_content('ism', '$INHERITS', true)" > /dev/null
as $A "update public.loved_ones set visibility = 'public' where id = '$AUNT'" > /dev/null
check "a picture the reviewer allowed stays allowed when Aunt is shared wider again" "approved|1" "$(status $INHERITS)|$(opens anon $A/inherited.jpg)"

echo "-- reports"
REPORTED=$(add $A $GRANDMA 'Report me.' friends $A/report.jpg)
as $B "select public.report_content('$REPORTED', null, 'Not kind')" > /dev/null
check "whoever reports it stops seeing it and its picture" "0|0" "$(sees $B $REPORTED)|$(opens $B $A/report.jpg)"
check "the reviewer can open it" "1" "$(opens $E $A/report.jpg)"
check "and finds it waiting, with its picture" "$A/report.jpg" "$(as $E "select picture_path from public.content_to_review() where item_id = '$REPORTED'")"

echo "-- a quote can't use someone else's picture"
MALS=$(as $M "insert into public.loved_ones (name, visibility) values ('Mal Own', 'friends') returning id")
check "adding one with someone else's picture is refused" "isms_picture_is_owners" "$(add $M $MALS 'Hi' null $A/friends.jpg | has 'isms_picture_is_owners')"
MALQ=$(add $M $MALS 'Mine.' null $M/mal.jpg)
check "her own picture is fine" "ok" "$(status $MALQ)"
check "switching to someone else's is refused" "isms_picture_is_owners" "$(as $M "update public.isms set picture_path = '$A/friends.jpg' where id = '$MALQ'" | has 'isms_picture_is_owners')"
check "a picture needs its size, and a size needs a picture" "isms_picture_size|isms_picture_size" "$(as $M "update public.isms set picture_width = null where id = '$MALQ'" | has 'isms_picture_size')|$(as $M "update public.isms set picture_path = null where id = '$MALQ'" | has 'isms_picture_size')"
$PSQL -c "alter table public.isms drop constraint isms_picture_is_owners" > /dev/null
$PSQL -c "update public.isms set picture_path = '$A/private.jpg' where id = '$MALQ'" > /dev/null
check "even if a borrowed path got in another way, it opens nothing" "0|0" "$(opens $M $A/private.jpg)|$(opens anon $A/private.jpg)"
$PSQL -q -f ../schema.sql > /dev/null 2>&1
check "running the schema again clears it" "|0" "$($PSQL -c "select coalesce(picture_path, '') from public.isms where id = '$MALQ'")|$($PSQL -c "select count(*) from public.isms where picture_path is not null and not starts_with(picture_path, owner_id::text || '/')")"

echo "-- deleting"
as $A "delete from public.isms where id = '$FRIENDS'" > /dev/null
check "once its quote is deleted, a picture opens for nobody but its author" "0|1" "$(opens $B $A/friends.jpg)|$(opens $A $A/friends.jpg)"
UNCLE=$(as $A "insert into public.loved_ones (name, visibility) values ('Ann Uncle', 'friends') returning id")
upload $D $D/uncle.jpg > /dev/null
DANS2=$(add $D $UNCLE 'Dan remembers him.' null $D/uncle.jpg)
check "(Dan adds a picture to her uncle, and her friend can open it)" "ok|1" "$(status $DANS2)|$(opens $B $D/uncle.jpg)"
as $A "delete from public.isms where id = '$DANS2'" > /dev/null
check "Ann can remove what Dan added, picture and all" "0|0" "$(sees $D $DANS2)|$(opens $B $D/uncle.jpg)"

echo "-- the bucket only takes small JPEGs"
check "photos and pictures up to 10 MB, JPEG only" "10485760|{image/jpeg}" "$($PSQL -c "select file_size_limit || '|' || allowed_mime_types::text from storage.buckets where id = 'photos'")"

finish

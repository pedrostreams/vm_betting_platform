Sport ID = FBL

VM tournement id = 45613

Request to get all WC games:

curl --request GET \
  --url https://api.norsk-tipping.no/OddsenGameInfo/v1/api/events/FBL/202606160000/202607162359 \
  --header 'Accept: application/json;charset=utf-8'

  Filter on tournament id.


Get live data for event.
curl --request GET \
  --url https://api.norsk-tipping.no/OddsenGameInfo/v1/api/livedata/8420692.1 \
  --header 'Accept: application/json;charset=utf-8'


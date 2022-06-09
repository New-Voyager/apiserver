#!/usr/bin/python3

from requests import head, post
from gql import gql, Client
from gql.transport.aiohttp import AIOHTTPTransport

bot_url = 'http://localhost:8081/'
# Select your transport with a defined url endpoint
TOKEN = '46e290db-b8a5-42a7-9f80-93f31919ebe8'
headers = {
    'Authorization': 'Bearer ' + TOKEN,
}
transport = AIOHTTPTransport(
    url="http://localhost:9501/graphql", headers=headers)

# Create a GraphQL client using the defined transport
client = Client(transport=transport, fetch_schema_from_transport=True)

# Provide a GraphQL query
query = gql(
    """
    mutation scheduleTournament($input:TournamentCreateInput!) {
     scheduleTournament(input: $input)
    }
    """
)
# Execute the query on the transport
variables = {
    "input": {
        "name": "Sunday tournament",
        "startingChips": 5000,
        "maxPlayersInTable": 6,
        "startTime": "2022-06-01T00:00:00"
    },
}
result = client.execute(query, variable_values=variables)
print(result)
tournament_id = result['scheduleTournament']
print(tournament_id)

# register bots for tournament
register_bots_url = f'{bot_url}register-tournament'
data = {
    'tournamentId': tournament_id,
    'botCount': 30
}
resp = post(register_bots_url, json=data)
print(resp.text)

if resp.status_code == 200:
    print('Successfully registered bots')
else:
    print('Failed to register bots')
    exit(1)

# start tournament
query = gql(
    """
      mutation startTournament($tournamentId: Int!) {
        startTournament(tournamentId:$tournamentId)
      }
    """)
variables = {
    "tournamentId": tournament_id
}
result = client.execute(query, variable_values=variables)
print(result)
if result['startTournament']:
    print(f'Tournament {tournament_id} started')

# monitor the tournament progress
print(f'tournament game: t-{tournament_id}-1')

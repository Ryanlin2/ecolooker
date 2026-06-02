import requests

BASE = "https://www.imf.org/external/datamapper/api/v2"

def get_raw_imf_json(indicator="NGDPD", start_year=1980, end_year=2029):
    """
    Fetch raw JSON directly from the IMF DataMapper API.

    Returns the original API response without converting it to a DataFrame
    or writing CSV/JSON files.
    """
    years = range(start_year, end_year + 1)
    periods = ",".join(map(str, years))

    url = f"{BASE}/{indicator}"

    response = requests.get(
        url,
        params={"periods": periods},
        timeout=60,
    )

    if not response.ok:
        print("FAILED URL:", response.url)
        print("STATUS:", response.status_code)
        print("BODY:", response.text[:500])

    response.raise_for_status()
    return response.json()
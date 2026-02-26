#!/usr/bin/env python3
"""
Miami3PL Google Analytics 4 Data Client
========================================
Pulls GA4 data using Firebase service account (OAuth2 — no API keys).

Auth: Uses existing Firebase service account from miamialliance3pl project.
The service account must be added as a Viewer in GA4 Admin > Property Access.

Prerequisites:
  1. Enable "Google Analytics Data API" in Google Cloud Console
     → https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=miamialliance3pl
  2. Enable "Google Analytics Admin API" in Google Cloud Console
     → https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com?project=miamialliance3pl
  3. Add the service account email as a Viewer in GA4:
     → GA4 Admin > Property > Property Access Management
     → Add: firebase-adminsdk-fbsvc@miamialliance3pl.iam.gserviceaccount.com

Usage:
  python3 ga_client.py setup          # Check prerequisites & discover property
  python3 ga_client.py overview       # Last 30 days overview
  python3 ga_client.py today          # Today's stats
  python3 ga_client.py realtime       # Real-time active users
  python3 ga_client.py visitors [N]   # Daily visitors for last N days (default 30)
  python3 ga_client.py pages [N]      # Top N pages (default 20)
  python3 ga_client.py sources [N]    # Top N traffic sources (default 20)
  python3 ga_client.py events [N]     # Top N events (default 20)
  python3 ga_client.py countries [N]  # Top N countries (default 20)
  python3 ga_client.py devices        # Device breakdown
  python3 ga_client.py report [days]  # Full report for last N days (default 30)
  python3 ga_client.py json [cmd]     # Output as JSON (for Symbio parsing)
"""

import sys
import os
import json
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# Service account path (same as Firebase)
SERVICE_ACCOUNT_PATH = Path(__file__).parent.parent.parent / "firebase-key.json"
# Cache file for GA4 property ID
PROPERTY_CACHE = Path(__file__).parent / ".ga_property_id"
# GA4 Measurement ID (for reference)
GA4_MEASUREMENT_ID = "G-KTW0F25ZM1"


def get_credentials():
    """Load service account credentials with GA4 scopes."""
    from google.oauth2 import service_account

    if not SERVICE_ACCOUNT_PATH.exists():
        print(f"ERROR: Service account not found at {SERVICE_ACCOUNT_PATH}")
        print("Download from Firebase Console > Project Settings > Service Accounts")
        sys.exit(1)

    scopes = [
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/analytics",
    ]
    creds = service_account.Credentials.from_service_account_file(
        str(SERVICE_ACCOUNT_PATH), scopes=scopes
    )
    return creds


def discover_property_id():
    """Use GA Admin API to find the GA4 property ID."""
    from google.analytics.admin_v1alpha import AnalyticsAdminServiceClient

    creds = get_credentials()
    client = AnalyticsAdminServiceClient(credentials=creds)

    try:
        # List all accessible GA4 accounts
        accounts = list(client.list_accounts())
        if not accounts:
            print("ERROR: No GA4 accounts accessible by service account.")
            print(f"Add this email as Viewer in GA4 Admin:")
            sa_data = json.loads(SERVICE_ACCOUNT_PATH.read_text())
            print(f"  {sa_data.get('client_email', 'unknown')}")
            return None

        for account in accounts:
            account_id = account.name.split("/")[-1]
            properties = list(
                client.list_properties(
                    filter=f'parent:accounts/{account_id}'
                )
            )
            for prop in properties:
                # Check if this property has our measurement ID
                prop_id = prop.name.split("/")[-1]
                streams = list(
                    client.list_data_streams(parent=prop.name)
                )
                for stream in streams:
                    if hasattr(stream, 'web_stream_data') and stream.web_stream_data:
                        if stream.web_stream_data.measurement_id == GA4_MEASUREMENT_ID:
                            # Cache it
                            PROPERTY_CACHE.write_text(prop_id)
                            return prop_id

        print(f"ERROR: Could not find property with measurement ID {GA4_MEASUREMENT_ID}")
        print("Available properties:")
        for account in accounts:
            account_id = account.name.split("/")[-1]
            properties = list(
                client.list_properties(filter=f'parent:accounts/{account_id}')
            )
            for prop in properties:
                print(f"  {prop.name} — {prop.display_name}")
        return None

    except Exception as e:
        error_msg = str(e)
        if "403" in error_msg or "PERMISSION_DENIED" in error_msg:
            print("ERROR: Permission denied. Check these steps:")
            print("  1. Enable 'Google Analytics Admin API' in Cloud Console:")
            print("     https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com?project=miamialliance3pl")
            sa_data = json.loads(SERVICE_ACCOUNT_PATH.read_text())
            print(f"  2. Add service account as Viewer in GA4 Admin:")
            print(f"     {sa_data.get('client_email', 'unknown')}")
        elif "404" in error_msg or "NOT_FOUND" in error_msg:
            print("ERROR: Google Analytics Admin API not enabled.")
            print("  Enable it: https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com?project=miamialliance3pl")
        else:
            print(f"ERROR: {e}")
        return None


def get_property_id():
    """Get GA4 property ID from cache or discover it."""
    if PROPERTY_CACHE.exists():
        return PROPERTY_CACHE.read_text().strip()
    prop_id = discover_property_id()
    if prop_id:
        return prop_id
    print("\nAlternative: Set property ID manually:")
    print("  1. Go to GA4 > Admin > Property Settings")
    print("  2. Copy the Property ID (numeric)")
    print(f"  3. Save it: echo 'YOUR_PROPERTY_ID' > {PROPERTY_CACHE}")
    sys.exit(1)


def get_data_client():
    """Create GA4 Data API client."""
    from google.analytics.data_v1beta import BetaAnalyticsDataClient

    creds = get_credentials()
    return BetaAnalyticsDataClient(credentials=creds)


def format_number(n):
    """Format number with commas."""
    try:
        return f"{int(n):,}"
    except (ValueError, TypeError):
        return str(n)


def format_duration(seconds):
    """Format seconds into human-readable duration."""
    try:
        s = int(float(seconds))
        if s < 60:
            return f"{s}s"
        m, s = divmod(s, 60)
        return f"{m}m {s}s"
    except (ValueError, TypeError):
        return str(seconds)


def format_percent(value):
    """Format as percentage."""
    try:
        return f"{float(value):.1f}%"
    except (ValueError, TypeError):
        return str(value)


# ══════════════════════════════════════════════════════════
# DATA QUERIES
# ══════════════════════════════════════════════════════════

def run_report(property_id, date_range_start, date_range_end, dimensions, metrics, limit=20, order_by_metric=None):
    """Generic GA4 report runner."""
    from google.analytics.data_v1beta.types import (
        RunReportRequest, DateRange, Dimension, Metric, OrderBy
    )

    client = get_data_client()
    dim_objs = [Dimension(name=d) for d in dimensions]
    met_objs = [Metric(name=m) for m in metrics]

    order_bys = []
    if order_by_metric:
        order_bys = [
            OrderBy(
                metric=OrderBy.MetricOrderBy(metric_name=order_by_metric),
                desc=True
            )
        ]

    request = RunReportRequest(
        property=f"properties/{property_id}",
        date_ranges=[DateRange(start_date=date_range_start, end_date=date_range_end)],
        dimensions=dim_objs,
        metrics=met_objs,
        limit=limit,
        order_bys=order_bys if order_bys else None,
    )

    try:
        response = client.run_report(request)
        return response
    except Exception as e:
        error_msg = str(e)
        if "403" in error_msg or "PERMISSION_DENIED" in error_msg:
            print("ERROR: Permission denied for GA4 Data API.")
            print("  1. Enable 'Google Analytics Data API':")
            print("     https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=miamialliance3pl")
            sa_data = json.loads(SERVICE_ACCOUNT_PATH.read_text())
            print(f"  2. Ensure service account has GA4 Viewer role:")
            print(f"     {sa_data.get('client_email', 'unknown')}")
        else:
            print(f"ERROR: {e}")
        sys.exit(1)


def cmd_setup():
    """Check prerequisites and discover property."""
    print("=" * 60)
    print("  MIAMI 3PL — GOOGLE ANALYTICS SETUP CHECK")
    print("=" * 60)

    # Check service account
    if SERVICE_ACCOUNT_PATH.exists():
        sa_data = json.loads(SERVICE_ACCOUNT_PATH.read_text())
        print(f"\n[OK] Service account found")
        print(f"     Email: {sa_data.get('client_email', 'unknown')}")
        print(f"     Project: {sa_data.get('project_id', 'unknown')}")
    else:
        print(f"\n[FAIL] Service account NOT found at {SERVICE_ACCOUNT_PATH}")
        return

    # Check property ID
    print(f"\n[...] Discovering GA4 property for {GA4_MEASUREMENT_ID}...")
    prop_id = get_property_id()
    print(f"[OK] GA4 Property ID: {prop_id}")

    # Test data access
    print(f"\n[...] Testing data access...")
    try:
        response = run_report(
            prop_id, "7daysAgo", "today", ["date"], ["activeUsers"], limit=1
        )
        if response.rows:
            print(f"[OK] Data API working! Recent active users: {response.rows[0].metric_values[0].value}")
        else:
            print(f"[OK] Data API connected (no data yet for this period)")
        print(f"\n{'=' * 60}")
        print(f"  ALL SYSTEMS GO — GA4 data access is operational")
        print(f"  Property ID: {prop_id}")
        print(f"  Measurement ID: {GA4_MEASUREMENT_ID}")
        print(f"{'=' * 60}")
    except SystemExit:
        pass


def cmd_overview(days=30):
    """Overview stats for the period."""
    prop_id = get_property_id()
    response = run_report(
        prop_id,
        f"{days}daysAgo", "today",
        [],
        [
            "activeUsers", "newUsers", "sessions", "screenPageViews",
            "averageSessionDuration", "bounceRate", "engagedSessions",
            "engagementRate", "eventsPerSession", "sessionsPerUser",
        ],
    )

    print(f"\n{'=' * 55}")
    print(f"  MIAMI 3PL — GA4 OVERVIEW (Last {days} Days)")
    print(f"{'=' * 55}")

    if response.rows:
        row = response.rows[0]
        vals = [v.value for v in row.metric_values]
        labels = [
            ("Active Users", format_number(vals[0])),
            ("New Users", format_number(vals[1])),
            ("Sessions", format_number(vals[2])),
            ("Page Views", format_number(vals[3])),
            ("Avg Session Duration", format_duration(vals[4])),
            ("Bounce Rate", format_percent(float(vals[5]) * 100)),
            ("Engaged Sessions", format_number(vals[6])),
            ("Engagement Rate", format_percent(float(vals[7]) * 100)),
            ("Events/Session", f"{float(vals[8]):.1f}"),
            ("Sessions/User", f"{float(vals[9]):.1f}"),
        ]
        max_label = max(len(l) for l, _ in labels)
        for label, val in labels:
            print(f"  {label:<{max_label}}  {val}")
    else:
        print("  No data available for this period.")

    print(f"{'=' * 55}")
    return response


def cmd_today():
    """Today's stats."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, "today", "today", [],
        ["activeUsers", "newUsers", "sessions", "screenPageViews", "averageSessionDuration"],
    )

    today_str = datetime.now().strftime("%Y-%m-%d")
    print(f"\n{'=' * 45}")
    print(f"  MIAMI 3PL — TODAY ({today_str})")
    print(f"{'=' * 45}")

    if response.rows:
        vals = [v.value for v in response.rows[0].metric_values]
        print(f"  Active Users         {format_number(vals[0])}")
        print(f"  New Users            {format_number(vals[1])}")
        print(f"  Sessions             {format_number(vals[2])}")
        print(f"  Page Views           {format_number(vals[3])}")
        print(f"  Avg Session          {format_duration(vals[4])}")
    else:
        print("  No visitors yet today.")

    print(f"{'=' * 45}")
    return response


def cmd_realtime():
    """Real-time active users."""
    from google.analytics.data_v1beta.types import (
        RunRealtimeReportRequest, Dimension, Metric
    )

    prop_id = get_property_id()
    client = get_data_client()

    try:
        request = RunRealtimeReportRequest(
            property=f"properties/{prop_id}",
            dimensions=[Dimension(name="unifiedScreenName")],
            metrics=[Metric(name="activeUsers")],
        )
        response = client.run_realtime_report(request)

        print(f"\n{'=' * 50}")
        print(f"  MIAMI 3PL — REAL-TIME ({datetime.now().strftime('%H:%M:%S')})")
        print(f"{'=' * 50}")

        total = sum(int(r.metric_values[0].value) for r in response.rows) if response.rows else 0
        print(f"  Active Users NOW:  {total}")

        if response.rows:
            print(f"\n  {'Page':<35} {'Users':>6}")
            print(f"  {'─' * 35} {'─' * 6}")
            for row in sorted(response.rows, key=lambda r: int(r.metric_values[0].value), reverse=True):
                page = row.dimension_values[0].value[:35]
                users = row.metric_values[0].value
                print(f"  {page:<35} {users:>6}")
        else:
            print("  No active users at this moment.")

        print(f"{'=' * 50}")
        return response

    except Exception as e:
        error_msg = str(e)
        if "403" in error_msg:
            print("ERROR: Real-time data requires GA4 Data API enabled.")
            print("  https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=miamialliance3pl")
        else:
            print(f"ERROR: {e}")
        sys.exit(1)


def cmd_visitors(days=30):
    """Daily visitors breakdown."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, f"{days}daysAgo", "today",
        ["date"],
        ["activeUsers", "newUsers", "sessions", "screenPageViews"],
        limit=days + 1,
    )

    print(f"\n{'=' * 65}")
    print(f"  MIAMI 3PL — DAILY VISITORS (Last {days} Days)")
    print(f"{'=' * 65}")
    print(f"  {'Date':<12} {'Users':>7} {'New':>7} {'Sessions':>9} {'PageViews':>10}")
    print(f"  {'─' * 12} {'─' * 7} {'─' * 7} {'─' * 9} {'─' * 10}")

    total_users = total_new = total_sessions = total_pv = 0

    if response.rows:
        rows_sorted = sorted(response.rows, key=lambda r: r.dimension_values[0].value)
        for row in rows_sorted:
            date_raw = row.dimension_values[0].value
            date_fmt = f"{date_raw[:4]}-{date_raw[4:6]}-{date_raw[6:]}"
            vals = [v.value for v in row.metric_values]
            u, n, s, p = int(vals[0]), int(vals[1]), int(vals[2]), int(vals[3])
            total_users += u
            total_new += n
            total_sessions += s
            total_pv += p
            print(f"  {date_fmt:<12} {u:>7,} {n:>7,} {s:>9,} {p:>10,}")

        print(f"  {'─' * 12} {'─' * 7} {'─' * 7} {'─' * 9} {'─' * 10}")
        print(f"  {'TOTAL':<12} {total_users:>7,} {total_new:>7,} {total_sessions:>9,} {total_pv:>10,}")
        avg_users = total_users / max(len(rows_sorted), 1)
        print(f"  {'AVG/DAY':<12} {avg_users:>7.1f}")

    print(f"{'=' * 65}")
    return response


def cmd_pages(limit=20):
    """Top pages by views."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, "30daysAgo", "today",
        ["pagePath"],
        ["screenPageViews", "activeUsers", "averageSessionDuration"],
        limit=limit,
        order_by_metric="screenPageViews",
    )

    print(f"\n{'=' * 70}")
    print(f"  MIAMI 3PL — TOP PAGES (Last 30 Days)")
    print(f"{'=' * 70}")
    print(f"  {'#':>3}  {'Page':<35} {'Views':>7} {'Users':>7} {'Avg Time':>9}")
    print(f"  {'─' * 3}  {'─' * 35} {'─' * 7} {'─' * 7} {'─' * 9}")

    if response.rows:
        for i, row in enumerate(response.rows, 1):
            page = row.dimension_values[0].value[:35]
            vals = [v.value for v in row.metric_values]
            print(f"  {i:>3}  {page:<35} {int(vals[0]):>7,} {int(vals[1]):>7,} {format_duration(vals[2]):>9}")

    print(f"{'=' * 70}")
    return response


def cmd_sources(limit=20):
    """Top traffic sources."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, "30daysAgo", "today",
        ["sessionSource", "sessionMedium"],
        ["sessions", "activeUsers", "engagementRate"],
        limit=limit,
        order_by_metric="sessions",
    )

    print(f"\n{'=' * 70}")
    print(f"  MIAMI 3PL — TRAFFIC SOURCES (Last 30 Days)")
    print(f"{'=' * 70}")
    print(f"  {'#':>3}  {'Source / Medium':<30} {'Sessions':>9} {'Users':>7} {'Engage%':>8}")
    print(f"  {'─' * 3}  {'─' * 30} {'─' * 9} {'─' * 7} {'─' * 8}")

    if response.rows:
        for i, row in enumerate(response.rows, 1):
            source = row.dimension_values[0].value
            medium = row.dimension_values[1].value
            sm = f"{source} / {medium}"[:30]
            vals = [v.value for v in row.metric_values]
            engage = format_percent(float(vals[2]) * 100)
            print(f"  {i:>3}  {sm:<30} {int(vals[0]):>9,} {int(vals[1]):>7,} {engage:>8}")

    print(f"{'=' * 70}")
    return response


def cmd_events(limit=20):
    """Top events."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, "30daysAgo", "today",
        ["eventName"],
        ["eventCount", "totalUsers"],
        limit=limit,
        order_by_metric="eventCount",
    )

    print(f"\n{'=' * 55}")
    print(f"  MIAMI 3PL — TOP EVENTS (Last 30 Days)")
    print(f"{'=' * 55}")
    print(f"  {'#':>3}  {'Event':<30} {'Count':>9} {'Users':>7}")
    print(f"  {'─' * 3}  {'─' * 30} {'─' * 9} {'─' * 7}")

    if response.rows:
        for i, row in enumerate(response.rows, 1):
            event = row.dimension_values[0].value[:30]
            vals = [v.value for v in row.metric_values]
            print(f"  {i:>3}  {event:<30} {int(vals[0]):>9,} {int(vals[1]):>7,}")

    print(f"{'=' * 55}")
    return response


def cmd_countries(limit=20):
    """Top countries."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, "30daysAgo", "today",
        ["country"],
        ["activeUsers", "sessions", "engagementRate"],
        limit=limit,
        order_by_metric="activeUsers",
    )

    print(f"\n{'=' * 60}")
    print(f"  MIAMI 3PL — TOP COUNTRIES (Last 30 Days)")
    print(f"{'=' * 60}")
    print(f"  {'#':>3}  {'Country':<25} {'Users':>7} {'Sessions':>9} {'Engage%':>8}")
    print(f"  {'─' * 3}  {'─' * 25} {'─' * 7} {'─' * 9} {'─' * 8}")

    if response.rows:
        for i, row in enumerate(response.rows, 1):
            country = row.dimension_values[0].value[:25]
            vals = [v.value for v in row.metric_values]
            engage = format_percent(float(vals[2]) * 100)
            print(f"  {i:>3}  {country:<25} {int(vals[0]):>7,} {int(vals[1]):>9,} {engage:>8}")

    print(f"{'=' * 60}")
    return response


def cmd_devices():
    """Device category breakdown."""
    prop_id = get_property_id()
    response = run_report(
        prop_id, "30daysAgo", "today",
        ["deviceCategory"],
        ["activeUsers", "sessions", "screenPageViews", "averageSessionDuration"],
        limit=10,
        order_by_metric="activeUsers",
    )

    print(f"\n{'=' * 65}")
    print(f"  MIAMI 3PL — DEVICE BREAKDOWN (Last 30 Days)")
    print(f"{'=' * 65}")
    print(f"  {'Device':<15} {'Users':>7} {'Sessions':>9} {'PageViews':>10} {'Avg Time':>9}")
    print(f"  {'─' * 15} {'─' * 7} {'─' * 9} {'─' * 10} {'─' * 9}")

    total_users = 0
    device_data = []
    if response.rows:
        for row in response.rows:
            device = row.dimension_values[0].value.capitalize()
            vals = [v.value for v in row.metric_values]
            u = int(vals[0])
            total_users += u
            device_data.append((device, u, int(vals[1]), int(vals[2]), vals[3]))

        for device, u, s, p, dur in device_data:
            pct = (u / total_users * 100) if total_users > 0 else 0
            bar = "█" * int(pct / 5)
            print(f"  {device:<15} {u:>7,} {s:>9,} {p:>10,} {format_duration(dur):>9}")
            print(f"  {'':15} {pct:>6.1f}% {bar}")

    print(f"{'=' * 65}")
    return response


def cmd_report(days=30):
    """Full comprehensive report."""
    print(f"\n{'═' * 65}")
    print(f"  MIAMI 3PL — FULL ANALYTICS REPORT")
    print(f"  Period: Last {days} days | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Website: https://megalopolisms.github.io/miamialliance3pl/")
    print(f"  GA4 ID: {GA4_MEASUREMENT_ID}")
    print(f"{'═' * 65}")

    cmd_overview(days)
    cmd_visitors(min(days, 14))  # Cap daily breakdown at 14 for readability
    cmd_pages(10)
    cmd_sources(10)
    cmd_events(10)
    cmd_countries(10)
    cmd_devices()

    print(f"\n{'═' * 65}")
    print(f"  END OF REPORT")
    print(f"{'═' * 65}")


def to_json(response, dimensions_names, metrics_names):
    """Convert GA4 response to JSON dict."""
    rows = []
    if response and response.rows:
        for row in response.rows:
            entry = {}
            for i, dim in enumerate(dimensions_names):
                entry[dim] = row.dimension_values[i].value if i < len(row.dimension_values) else None
            for i, met in enumerate(metrics_names):
                entry[met] = row.metric_values[i].value if i < len(row.metric_values) else None
            rows.append(entry)
    return rows


def cmd_json(subcmd, args):
    """Output command results as JSON for Symbio parsing."""
    prop_id = get_property_id()

    if subcmd == "overview":
        days = int(args[0]) if args else 30
        response = run_report(
            prop_id, f"{days}daysAgo", "today", [],
            ["activeUsers", "newUsers", "sessions", "screenPageViews",
             "averageSessionDuration", "bounceRate", "engagedSessions", "engagementRate"],
        )
        data = to_json(response, [],
                       ["activeUsers", "newUsers", "sessions", "screenPageViews",
                        "averageSessionDuration", "bounceRate", "engagedSessions", "engagementRate"])
        print(json.dumps({"period": f"last_{days}_days", "data": data}, indent=2))

    elif subcmd == "visitors":
        days = int(args[0]) if args else 30
        response = run_report(
            prop_id, f"{days}daysAgo", "today",
            ["date"], ["activeUsers", "newUsers", "sessions", "screenPageViews"],
            limit=days + 1,
        )
        data = to_json(response, ["date"], ["activeUsers", "newUsers", "sessions", "screenPageViews"])
        print(json.dumps({"period": f"last_{days}_days", "daily": data}, indent=2))

    elif subcmd == "pages":
        limit = int(args[0]) if args else 20
        response = run_report(
            prop_id, "30daysAgo", "today",
            ["pagePath"], ["screenPageViews", "activeUsers"],
            limit=limit, order_by_metric="screenPageViews",
        )
        data = to_json(response, ["pagePath"], ["screenPageViews", "activeUsers"])
        print(json.dumps({"pages": data}, indent=2))

    elif subcmd == "sources":
        limit = int(args[0]) if args else 20
        response = run_report(
            prop_id, "30daysAgo", "today",
            ["sessionSource", "sessionMedium"], ["sessions", "activeUsers"],
            limit=limit, order_by_metric="sessions",
        )
        data = to_json(response, ["sessionSource", "sessionMedium"], ["sessions", "activeUsers"])
        print(json.dumps({"sources": data}, indent=2))

    elif subcmd == "today":
        response = run_report(
            prop_id, "today", "today", [],
            ["activeUsers", "newUsers", "sessions", "screenPageViews"],
        )
        data = to_json(response, [], ["activeUsers", "newUsers", "sessions", "screenPageViews"])
        print(json.dumps({"date": datetime.now().strftime("%Y-%m-%d"), "data": data}, indent=2))

    else:
        print(json.dumps({"error": f"Unknown json subcommand: {subcmd}", "available": ["overview", "visitors", "pages", "sources", "today"]}))


# ══════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ══════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1].lower()
    args = sys.argv[2:]

    commands = {
        "setup": lambda: cmd_setup(),
        "overview": lambda: cmd_overview(int(args[0]) if args else 30),
        "today": lambda: cmd_today(),
        "realtime": lambda: cmd_realtime(),
        "visitors": lambda: cmd_visitors(int(args[0]) if args else 30),
        "pages": lambda: cmd_pages(int(args[0]) if args else 20),
        "sources": lambda: cmd_sources(int(args[0]) if args else 20),
        "events": lambda: cmd_events(int(args[0]) if args else 20),
        "countries": lambda: cmd_countries(int(args[0]) if args else 20),
        "devices": lambda: cmd_devices(),
        "report": lambda: cmd_report(int(args[0]) if args else 30),
        "json": lambda: cmd_json(args[0] if args else "overview", args[1:]),
    }

    if cmd in commands:
        commands[cmd]()
    else:
        print(f"Unknown command: {cmd}")
        print(f"Available: {', '.join(commands.keys())}")
        sys.exit(1)


if __name__ == "__main__":
    main()

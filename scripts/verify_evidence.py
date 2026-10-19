"""Independently validate exported SyncSphere JSON and CSV (Python standard library only).

Usage:
    python scripts/verify_evidence.py path/to/evidence.json path/to/samples.csv

Exit nonzero for mismatches, duplicate/missing trials or inconsistent summaries.
Compatible with historical V2.2 and improved V2.3 reports.
"""
from __future__ import annotations
import csv
import json
import math
import sys
from pathlib import Path


def stats(values):
    values = sorted(values)
    if not values:
        return dict(count=0, average=None, median=None, p95=None, maximum=None)
    n = len(values)
    return dict(count=n, average=round(sum(values) / n, 3),
                median=round(values[n // 2] if n % 2 else (values[n//2 - 1] + values[n//2]) / 2, 3),
                p95=round(values[math.ceil(n * .95) - 1], 3), maximum=round(values[-1], 3))


def close(a, b, key):
    if a is None or b is None:
        assert a == b, f'{key}: {a} != {b}'
    else:
        assert math.isclose(a, b, abs_tol=.002), f'{key}: {a} != {b}'


def check(filename_json: str, filename_csv: str) -> None:
    report = json.loads(Path(filename_json).read_text(encoding='utf-8'))
    with open(filename_csv, newline='', encoding='utf-8-sig') as handle:
        rows = list(csv.DictReader(handle))
    assert report['schema'] in ('syncsphere-lab-report/1.0', 'syncsphere-lab-report/2.0', 'syncsphere-lab-report/2.1')
    assert len(rows) == sum(len(report[k][subset]) for k, subset in [('benchmark','samples'),('stress','trials'),('fanout','samples')] if report.get(k)), 'CSV count does not equal JSON count'
    for section, kind, field in [('benchmark','benchmark','samples'),('stress','conflict','trials'),('fanout','fanout','samples')]:
        group = report.get(section)
        matching = [row for row in rows if row['test'] == kind]
        if not group:
            assert not matching, f'Unexpected {kind} rows'
            continue
        samples = group[field]
        assert len(matching) == len(samples), f'{section}: row mismatch'
        idx = {(row['trial'], row['target_peer']): row for row in matching}
        assert len(idx) == len(matching), f'{section}: duplicate CSV trial/target'
        if section == 'benchmark':
            assert all(s['sequence'] == i for i, s in enumerate(samples,1)), 'Nonsequential benchmark sample'
            assert len(samples) <= group['requested']
            good = [s for s in samples if s['passed']]
            for json_key, col in [('deliveryStats','deliveryMs'),('rttStats','acknowledgementMs')]:
                numeric = [s[col] for s in good if isinstance(s[col], (int,float)) and math.isfinite(s[col])]
                expected = stats(numeric)
                for k, v in expected.items(): close(group[json_key][k], v, section + '.' + json_key + '.' + k)
            below = 'acknowledgementMs' if report['schema'].endswith('2.1') else 'deliveryMs'
            assert sum(s['passed'] and isinstance(s[below], (int,float)) and s[below] <= 100 for s in samples) == group['achievedUnder100ms']
        elif section == 'stress':
            assert group['converged'] == sum(s['converged'] for s in samples)
            assert len(samples) <= group['requested']
        else:
            assert group['successful'] == sum(s['success'] for s in samples)
            assert group['recovered'] == sum(s['recovered'] for s in samples)
            total = len(group['targetPeers']) * group['requestedPerPeer']
            assert group['successful'] + group['failed'] == total
            assert group['failed'] >= sum(not s['success'] for s in samples)
            expected = stats([s['ackRttMs'] for s in samples if s['success'] and s['ackRttMs'] is not None])
            for k, v in expected.items(): close(group['rttStats'][k], v, section + '.rttStats.' + k)
            if report['schema'].endswith('2.1'):
                for s in samples:
                    assert len(s['attemptDurationsMs']) == s['attempts']
                    assert s['totalElapsedMs'] + .05 >= sum(s['attemptDurationsMs'])
                    if s['success']: close(s['ackRttMs'], s['attemptDurationsMs'][-1], 'last attempt RTT')
                    if s['recovered']: assert s['attempts'] > 1
        for sample in samples:
            who = sample.get('peer', group.get('targetPeer'))
            row = idx[(str(sample['sequence']), str(who))]
            assert row['run_id'] == group['id']
            success = sample.get('passed', sample.get('converged', sample.get('success')))
            assert row['success'].lower() == str(success).lower(), f'{section}: wrong pass flag'
            if section in ('benchmark','fanout'):
                ms = sample.get('acknowledgementMs', sample.get('ackRttMs'))
                assert row['ack_rtt_ms'] == ('' if ms is None else str(ms))
            if section == 'fanout' and report['schema'].endswith('2.1'):
                assert row['total_elapsed_ms'] == str(sample['totalElapsedMs'])
    print(f"PASS: {report['application']} — {len(rows)} CSV records matched JSON; independent stats and denominators verified")
    for k in ('benchmark','stress','fanout'):
        part = report.get(k)
        if part:
            print(f"  {k}: {len(part['samples' if k != 'stress' else 'trials'])} raw samples")
    bench = report.get('benchmark')
    if bench:
        diagnostics = sum(s['deliveryMs'] is not None and s['acknowledgementMs'] is not None and s['deliveryMs'] > s['acknowledgementMs'] + .05 for s in bench['samples'] if s['passed'])
        print(f'  One-way estimates greater than RTT by >.05 ms: {diagnostics} (diagnostic uncertainty, not a failed ACK)')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    try:
        check(sys.argv[1], sys.argv[2])
    except (AssertionError, KeyError, ValueError) as exc:
        sys.exit(f'FAIL: {exc}')

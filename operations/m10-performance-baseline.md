# M10 performance baseline

Measured from the M10 production build on 2026-09-02:

| Asset group | Files | Raw total | Largest file |                Enforced budget |
| ----------- | ----: | --------: | -----------: | -----------------------------: |
| JavaScript  |    30 | 1,111 KiB |      247 KiB | 1,465 KiB total / 342 KiB file |
| CSS         |     2 |   107 KiB |      104 KiB |   146 KiB total / 122 KiB file |

The build budget runs after every CI production build. It measures emitted raw
assets, so compressed network transfer is lower but is not used to hide growth.

The staging database inspection on 2026-09-01 reported a 16 MB database,
approximately 736 KiB of table data, approximately 1,040 KiB of indexes, and
1.00 table/index cache-hit ratios. The remaining size is expected catalog and
extension overhead. Query inspection found no slow user-facing query in the
small staging dataset; the largest observed statement was the one-time generated
word-catalog migration.

The version-controlled, rollback-only 100-player database workload passed on
staging and on the isolated restored backup on 2026-09-03. The separate live
Realtime transport rehearsal also connected 100/100 independent clients and
delivered its privacy-safe probe to 100/100 clients. Join latency was 596 ms at
p50, 1,024 ms at p95, and 1,104 ms maximum; all clients disconnected during
cleanup.

At rehearsal time, organization usage remained below the 70% stop threshold:
egress was 15%, database size 7%, cached egress 3%, and Realtime messages,
storage, and monthly active users were each below 1%. The dashboard's peak
Realtime metric may take up to 24 hours to reflect the run. Avatar and
result-image checks use the maximum permitted avatar and an eight-player
standings image.

The authenticated browser matrix passed on 2026-09-03 at 1280 x 800 and
390 x 844 for Home, Daily, Free Play, Friends, Leaderboards, Profile, Settings,
and the existing Friendly Battle lobby. The mobile account drawer was also
opened and inspected. No application error state or browser warning/error was
reported during the matrix.

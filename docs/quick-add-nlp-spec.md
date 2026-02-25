# Quick-Add NLP Recurrence Spec

Running list of natural-language quick-add phrases we support. These are enforced by parser spec cases `PARSE_121` through `PARSE_144` in `docs/test-cases.yaml`.

| Phrase | recurrence_rule | due_text |
| --- | --- | --- |
| `every 2 months` | `FREQ=MONTHLY;INTERVAL=2` |  |
| `daily at 3am` | `FREQ=DAILY;INTERVAL=1;BYHOUR=3;BYMINUTE=0` |  |
| `on the 23rd every month` | `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=23` |  |
| `every 2 weeks` | `FREQ=WEEKLY;INTERVAL=2` |  |
| `thursday at 5pm` |  | `thursday at 5pm` |
| `4 weeks from now` |  | `4 weeks from now` |
| `every other week` | `FREQ=WEEKLY;INTERVAL=2` |  |
| `every two weeks` | `FREQ=WEEKLY;INTERVAL=2` |  |
| `biweekly` | `FREQ=WEEKLY;INTERVAL=2` |  |
| `twice a month` | `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1,15` |  |
| `every month on the 23rd` | `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=23` |  |
| `on the 23rd of each month` | `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=23` |  |
| `first monday of every month` | `FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO` |  |
| `last friday of every month` | `FREQ=MONTHLY;INTERVAL=1;BYDAY=-1FR` |  |
| `every weekday at 9am` | `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0` |  |
| `weekdays at 9` | `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0` |  |
| `every weekend` | `FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,SU` |  |
| `every thursday at 5pm` | `FREQ=WEEKLY;INTERVAL=1;BYDAY=TH;BYHOUR=17;BYMINUTE=0` |  |
| `thursdays at 5pm` | `FREQ=WEEKLY;INTERVAL=1;BYDAY=TH;BYHOUR=17;BYMINUTE=0` |  |
| `every day at 3am` | `FREQ=DAILY;INTERVAL=1;BYHOUR=3;BYMINUTE=0` |  |
| `every morning` | `FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0` |  |
| `every night` | `FREQ=DAILY;INTERVAL=1;BYHOUR=21;BYMINUTE=0` |  |
| `in 4 weeks` |  | `in 4 weeks` |
| `next thursday at 5pm` |  | `next thursday at 5pm` |

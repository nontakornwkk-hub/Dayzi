# Focused Dayzi workspace

User request: enlarge chat, remove decorative headers and technical provider labels, daily/weekly/monthly To-do, improve dark theme, move secondary controls into a right sidebar, show every calendar item, recommend a LINE rich menu. Local only.

Design decisions delegated by the user's request to help choose: neutral charcoal/lavender dark palette; chat occupies the full primary pane; right tools drawer closed by default for chat and on narrow screens; calendar has a month grid plus complete agenda (appointments and dated tasks), with day/month switching; task periods Today/This week/This month/All, independent completion filters and explicit due-date entry. No new task recurrence or schema change is implied by period views. Overdue and undated work remain available through clear scopes.

Implementation: add shared pure date-period/agenda helpers and behavioral tests; simplify chat markup and move quick prompts to tools drawer; add task periods and due-date input; integrate complete calendar agenda and item counts; replace green dark theme and tune responsive layout; test UI, build, inspect narrow and desktop screenshots; final focused review. Existing non-Git workspace is retained. No Google/LINE external configuration or deployment.

Verification focus: month/week boundary dates; overdue/undated tasks reachable; more than three items on one day remain accessible; calendar filters cannot accidentally hide items without indication; chat still scrolls; drawer closes with Escape; all buttons have clear labels. Rich menu is advice only, not published.

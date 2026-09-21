---
schemaVersion: 1
kind: view
title: Task Calendar
description: Read-only calendar of configured task due dates.
mode: calendar
source:
  type: pages
  taxonomy:
    spaces:
      - tasks
calendar:
  start:
    field: fields.dueDate
  firstDayOfWeek: monday
---

# Task Calendar

Task dates remain in the source Markdown. WebApp provides month navigation and Agenda; static pages show the complete Agenda.

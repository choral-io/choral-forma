---
schemaVersion: 1
kind: term
taxonomy: collections
id: all-day
title: All-day Exhibits
include: ["exhibits/all-day/*.md"]
schema:
    type: object
    fields:
        opensOn: { type: date }
        closesOn: { type: date }
        isMilestone: { type: boolean }
        percentComplete: { type: integer }
        category: { type: string }
        visible: { type: boolean }
        predecessors:
            type: list
            items: { type: entryRef }
---

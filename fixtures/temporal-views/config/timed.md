---
schemaVersion: 1
kind: term
taxonomy: collections
id: timed
title: Timed Exhibits
include: ["exhibits/timed/*.md"]
schema:
    type: object
    fields:
        opensOn: { type: datetime }
        closesOn: { type: datetime }
        isMilestone: { type: boolean }
        percentComplete: { type: integer }
        category: { type: string }
        visible: { type: boolean }
        predecessors:
            type: list
            items: { type: entryRef }
---

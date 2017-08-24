# Trello Estimate Tool

Converts Trello milestone tasks to new cards using a template card.

## Board setup

You need two things. A template card and one or more milestone cards.

### Template card

The new cards will copy the checklists from this card.

### Milestone cards

Milestone cards are cards that have a checklist of tasks that will be converted to cards. Checklist tasks must take the following form:
 
```
Task title (@user1/@user2/...) - low-estimate/high-etsimate
```
 
An example task:
 
```
Create form (@jerrysmith/@rsanchez) - 6/10
```

Estimates are expected to be **whole numbers**.
 
The estimates are optional, but **each task must be assigned to at least one person**.
 
```
Unestimated task (@jerrysmith)
```

## Usage

Install NPM requirements:

```bash
npm install
```

Add to your PATH:

```bash
npm link
```

Run it:

```bash
trello-estimate-tool
```
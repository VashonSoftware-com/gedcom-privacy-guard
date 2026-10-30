# Help wanted: testers

So far GEDCOM Privacy Guard has been tested on real exports from Legacy
only. Every program writes GEDCOM a little differently, and notes hide
in different places. Here's how you can help, from five minutes up.

**Never send us your real family tree**, or a review spreadsheet made
from it. Everything below uses a made-up tree or reports what happened
without the data.

## 1. Send a made-up sample export (about 20 minutes)

We most want files from **RootsMagic, Family Tree Maker, Gramps,
Ancestry, MyHeritage, FamilySearch and Reunion** (Legacy is covered).

1. **Start a new, empty tree** in your program. Don't use your real one.
2. **Enter the made-up family below.** Put each note where it says,
   because the point is to see where your program stores each kind.
   Skip anything your program has no place for, and tell us.
3. **Set yourself as the submitter or researcher using a made-up name**
   ("Test Tester", no address or email). Most programs put your own
   details in every export.
4. **Export it as GEDCOM** ([how, for each program](exporting.md)). If
   there are options, say which you chose.
5. **Open the `.ged` file in Notepad** (or TextEdit) and search for
   your real name, email and town, just in case.
6. **Zip it** (GitHub won't take a `.ged` file directly; on Windows,
   right-click → Send to → Compressed folder) and **attach it** to a new
   [*Sample export*](https://github.com/VashonSoftware-com/gedcom-privacy-guard/issues/new?template=sample-export.yml)
   issue.

### The made-up family

| Who | Facts | Notes to type, and where |
|---|---|---|
| **Albert Testfield**, b. 1890, d. 1950 | Birth, death | *Person note:* "Albert was in the state hospital for depression in 1935." *Cause of death* (on the death fact, if your program has it): "cirrhosis". *Note on the death fact:* "Family says he drank." |
| **Clara Moss**, b. 1895, d. 1980, his wife | Birth, death, marriage to Albert in 1915 | *Person note:* "Clara's SSN was 123-45-6789." *Address* (if your program has one): "12 Elm St, Springfield, phone 555-201-3344". |
| **Albert & Clara's family** | Marriage 1915, divorce 1940 | *Family / marriage note:* "They divorced after his arrest for theft." |
| **Ruth Testfield**, b. 1920, daughter | Birth only (so she looks living) | *Person note:* "Ruth was adopted. [[Private: her birth mother was a neighbour.]]" |
| **A source**: "Springfield Gazette, 1935" | Cite it on Albert's death | *Source text:* "rumored to have been committed". *Citation detail / page:* "p. 4, col. 2". |
| A **photo** of Albert | Any small image | Link it to Albert. We want to see how the file path is written. |
| A **custom fact** on Clara, e.g. "Occupation" or your own type | | "Reportedly a bootlegger's sister." |

## 2. Try it out (15 minutes)

Our goal: someone who has never seen the tool opens it, checks an
export and saves a cleaned file in **under 15 minutes**, with no help.

1. Start a timer and open <https://gedcom.vashonsoftware.com>.
2. Use your own export if you like (it never leaves your computer) or
   our [sample tree](https://raw.githubusercontent.com/VashonSoftware-com/gedcom-privacy-guard/main/sample_data/sample.ged)
   (right-click, *Save link as*).
3. Stop the timer when you have the cleaned file, or at 15 minutes.
4. Tell us how it went in a
   [*Tried it*](https://github.com/VashonSoftware-com/gedcom-privacy-guard/issues/new?template=tried-it.yml)
   issue: how long it took, where you got stuck, and what didn't make
   sense. Share times and steps only, not your notes or the spreadsheet.
5. If something went wrong, press **Copy a problem report** (below the
   list, or under the error) and paste it into a
   [*Something went wrong*](https://github.com/VashonSoftware-com/gedcom-privacy-guard/issues/new?template=problem.yml)
   issue. It says which program made your file and how big it is, never
   what's in it, and you see every word before you paste.

Comfortable with a command line? Try the same with the
[command-line version](../README.md) instead.

## 3. Tell us what it got wrong

- A note it flagged that's fine:
  [*False alarm*](https://github.com/VashonSoftware-com/gedcom-privacy-guard/issues/new?template=false-alarm.yml).
- A note it should have flagged:
  [*Missed something*](https://github.com/VashonSoftware-com/gedcom-privacy-guard/issues/new?template=missed-something.yml).

Rewrite the note with names, dates and places changed first.

## 4. Tell others

If it helped you, mention it to your genealogy society, user group or
forum (RootsMagic Community, the Legacy user groups, WikiTree G2G,
r/Genealogy). Lead with the problem it solves, not the tool:
*"Before you upload a tree, check what your notes say about the
living."* Read each group's rules on self-promotion first.

## 5. Developers

See [CONTRIBUTING.md](../CONTRIBUTING.md) for running the tests and
adding a rule.

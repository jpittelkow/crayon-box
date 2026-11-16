# Research: what helps 2 to 5 year olds learn letters, on a touch screen

Research for section 5 of the [to-do list](../todo.md) ("Letters: sound, tips and how-to, then words"), done
2026-11-15. The plan built on it is [letters-plan.md](../letters-plan.md); the decision it proposes is
[ADR 0037](../adr/0037-letters-sound-tips-and-how-to.md).

**How sure each finding is.** Most studies here are small, many are with 5 to 7 year olds or with children who
have a disability, and almost none tested an app like ours. Each finding says how strong the evidence is:
**strong** (several studies or a large trial), **moderate** (one or two decent studies), **weak** (thin, older
kids only, or guidance without studies). Sources marked _(abstract)_ were checked from the abstract or an
index page, not read in full.

**What exists today** (ADR 0026, 0028, 0032): one big letter as a pale road; pulsing green start dots, arrows and
a pressing finger on the first dot; a fingertip that runs along the next stroke after 8 seconds of nothing;
dots on what is left when a kid lifts with half the letter done; a check button once it is all traced; then the
bell, the letter's name and a random praise word ("Yay!", "You did it!", "Great job!", "Wow!") from the narrator.
Touch sounds are the app's tap, fill and undo. Capitals by default, alphabetical order, any order and direction
unless a parent turns stroke order on.

---

## 1. How letters are learned

### 1.1 Making letters by hand helps; free copying helps more than tracing (moderate)
- Pre-reading 4 and 5 year olds who practised letters by **printing them freehand** later showed reading-like
  brain activity when they saw those letters; children who **traced** or **typed** them did not. The authors
  think the planning of each stroke, and the wobbly, varied letters kids make, are what count.
  [James & Engelhardt 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC4274624)
- 5 and 6 year olds learning new letters did better writing them by hand than typing, and **copying beat tracing
  over dotted guides**. The authors advise tracing as a first step, then free writing once the movements are
  sure. [Ibaibarriaga, Acha & Perea 2025, summary](https://www.sciencedaily.com/releases/2025/04/250430142559.htm)
- Older work found the same for 3 to 5 year olds (Longcamp 2005); a German kindergarten study found no
  difference. [overview, Frontiers 2021](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.726454/full)

**For the app:** tracing is the right first step for this age, but it should not be the last. Over time a letter's
guide can fade (full road, then a thinner one, then only start dots, then the letter shown small beside an empty
space). Never snap the kid's line to a perfect shape: their own wobbly letter is the useful part.

### 1.2 Capitals first, in groups that share a start (moderate for capitals first, weak for any one order)
- Preschoolers usually know capitals before small letters; among 461 children aged 3 to 5, knowing a capital
  was the strongest predictor of knowing its small letter.
  [Turnbull et al. 2010](https://pubs.asha.org/doi/10.1044/1092-4388(2010/09-0093)) _(abstract)_
- Handwriting Without Tears (now Learning Without Tears) teaches capitals in groups by where they start: letters
  that start at the top left corner with a big line down (F E D P B R N M), other top-corner starters
  (H K L U V W X Y Z), and letters that start in the middle at the top (C O Q G S A I T J). The reasons given
  (easier, fewer reversals) are the publisher's, not a study's.
  [teacher's guide](https://issuu.com/handwritingwithouttears/docs/ksktg_2022/167) _(abstract)_
- Jolly Phonics' order (s a t i p n first) is picked so the first letters make many words. It is an order for
  sounds and reading, not for ease of writing.
  [NI Assembly research paper 2026](https://www.niassembly.gov.uk/globalassets/documents/raise/publications/2022-2027/2026/education/0226.pdf) _(abstract)_

**For the app:** capitals first, as today (ADR 0026), is supported. An "easy first" order for the game path
(straight-line letters, then the ones with curves) is reasonable but no order is proven better. The practice grid
stays alphabetical so a parent can find a letter. A sounds-and-words order like Jolly Phonics belongs with words,
later.

### 1.3 Lines and shapes come before letters (moderate for the order, weak for the ages)
- The usual sequence occupational therapists use (from the Beery VMI test): copies a **line down** at about 2,
  a **line across** at about 2½, a **circle** at about 3, a **cross** at about 3½ to 4, a **square** and a
  **slant** at about 4 to 4½, an **X** at about 4½ to 5, a **triangle** at about 5. Ages vary by half a year
  between sources, and these are from OT and teacher guidance, not the manual.
  [Growing Hands-On Kids](https://www.growinghandsonkids.com/pre-writing-skills-checklist-kids.html),
  [continued.com, ask the experts](https://www.continued.com/early-childhood-education/ask-the-experts/what-shapes-do-children-need-22714)
- A common OT rule of thumb: letters once a child can copy the cross, square and slants. No study ties it down.

**For the app:** many of the kids are under 4, so most of them are not yet ready for letters with slants and
crossings. A "lines and shapes" set (line down, line across, circle, cross, slant, square, X, triangle), traced
with the same engine, would give the youngest something they can actually finish, and every capital is made of
these strokes.

### 1.4 Start dots, arrows and the same words for the same stroke (moderate; the best classroom evidence)
- Among six ways of teaching first graders with poor handwriting, the best was: look at a letter with **numbered
  arrows** on its strokes, cover it, write it from memory. It improved letters, speed and even their stories.
  [Berninger et al. 1997, UW news](https://www.washington.edu/news/1998/01/30/in-spite-of-computers-handwriting-instruction-is-important-because-of-carry-over-to-composition/)
- The handwriting programs each use one fixed set of words for the strokes ("pull down straight", "slide right",
  "circle back" in Zaner-Bloser; "big line down", "magic c" in Handwriting Without Tears).
  [Zaner-Bloser stroke information](https://www.tesd.net/cms/lib/PA01001259/Centricity/Domain/1367/Zaner%20Bloser%20Handwriting%20Stroke%20Information.pdf) _(abstract)_
- Guides say visual cues should be removed bit by bit.
  [Iowa Reading Research Center](https://irrc.education.uiowa.edu/sites/irrc.education.uiowa.edu/files/2023-05/how_to_make_handwriting_part_of_early_literacy_instruction.pdf) _(abstract)_
- Small children tend to draw lines from the bottom up, so "start at the top" has to be taught.
- The evidence is from 6 and 7 year olds; nothing compares one set of words with another.

**For the app:** the start dots and arrows we have are the right idea. Add **spoken stroke words**, always the
same for the same kind of stroke ("Down.", "Across.", "Around."), worked out from the stroke data, so every letter
gets them without per-letter clips. Start-at-the-top is already in the stroke data (ADR 0028).

### 1.5 Sand trays, sky writing and other "multi-sensory" ideas (weak)
- Reviews find occupational therapy for handwriting helps in general, but there is no controlled evidence for
  sand trays or sky writing as such, and a meta-analysis found motor-only training didn't help handwriting.
  [Santangelo & Graham 2016, Reading Rockets](https://www.readingrockets.org/resources/resource-library/comprehensive-meta-analysis-handwriting-instruction)

**For the app:** a finger on a big screen is already a large, felt movement. Don't build extras for "multi-sensory"
reasons; add them only if they are fun.

### 1.6 Letter names and sounds, taught together (moderate)
- 58 children aged 3 and 4 were randomly given 34 short lessons. Teaching **names and sounds together** tended to
  beat sounds alone. Sounds were easiest for letters whose name holds the sound (B, D, T at the start; F, M, S at
  the end) and hardest for H, W, Y. Effects were modest.
  [Piasta, Purpura & Wagner 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2978809)
- The National Early Literacy Panel (about 300 studies) found letter knowledge, writing letters and writing one's
  name are among the strongest early signs of later reading. That is a link, not proof that teaching them causes it.
  [Teale et al. 2010 on the NELP report](https://www.readinghalloffame.org/sites/default/files/Teale_et_al_EdRsrchr_NELP_2010.pdf) _(abstract)_
- Families differ: US schools tend to start with names, English schools with sounds.
  [Ellefson, Treiman & Kessler 2009](https://profiles.wustl.edu/en/publications/learning-to-label-letters-by-sounds-or-names-a-comparison-of-engl/) _(abstract)_

**For the app:** a parent setting with three choices fits the evidence and the family split: **name** (today),
**name then sound** ("B. Buh."), **sound only**. Phonics teaching keeps sounds short and clean ("mmm", not "muh")
where it can; that is common classroom practice rather than a study finding, and the AI voice will need takes picked
by ear.

### 1.7 After single letters: own name, then short words, then "your own way" (moderate, ages 4 to 6)
- Children know the letters of their own first name best, above all the first one, and use it early when they
  start spelling by sound.
  [Treiman et al., own-name study](https://profiles.wustl.edu/en/publications/learning-to-spell-phonologically-influences-of-childrens-own-name/)
- Writing grows from scribbles, to the child's name, to letters, to spelling; by the end of preschool writing
  letters predicts later spelling better than writing one's name.
  [Puranik & Lonigan 2011](https://pmc.ncbi.nlm.nih.gov/articles/PMC3172137) _(abstract)_
- Kindergartners who practised writing words **their own way** ("invented spelling") with gentle feedback
  learned to read more words than other groups.
  [Ouellette & Sénéchal, Reading Rockets summary](https://www.readingrockets.org/resources/resource-library/invented-spelling-kindergarten-predictor-reading-and-spelling-grade-1) _(abstract)_

**For the app:** words come in this order: (a) the kid's own name, from the profile a parent typed (it stays on
the device, ADR 0018); (b) short three-letter words made of letters the kid has already traced (cat, sun, bus);
(c) much later, maybe, writing a word "your own way". The narrator can say short words, but not a kid's name,
which the app doesn't know ahead of time: the parent's own recording covers that.

---

## 2. Touch screens

### 2.1 Fingers did best (moderate)
- 3½ to 5½ year olds practised eight capitals three times a week for eight weeks on paper, on a tablet with a
  finger, or on a tablet with a stylus. **The finger group wrote the most letters correctly afterwards**; the
  stylus group did about as well as paper. The tablet's instant "wrong" signals did not help. The authors
  credit the feel of the finger on glass.
  [Patchan & Puranik 2016, Research Connections](https://researchconnections.org/childcare/resources/32955)
  _(abstract)_
- Kindergarten classes using a stylus handwriting app improved only for kids who started in the middle, not the
  weakest or strongest. [Bonneton-Botté et al. 2020](https://hal.archives-ouvertes.fr/hal-02480182) _(abstract)_
- A kindergarten study of pencil, keyboard and tablet found mixed results by tool (paid for by a pencil maker).
  [Mayer et al. 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC6987467)
- Whether tablet practice carries over to paper is not settled (weak).

**For the app:** fingers first is right (ADR 0026); a pen is fine, not better. Don't count on "wrong" signals to
teach. In the parent area, suggest crayons on paper too.

### 2.2 Sound that follows the finger (weak to moderate)
- Turning pen movement into sound as it happens makes adults' writing faster and smoother; one study with
  children with handwriting difficulties was a small pilot with no control group.
  [Danna & Velay, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4335466),
  [Danna & Velay, LNC](https://lnc.univ-amu.fr/doc/hal-01230184/_22.html) _(abstract)_

**For the app:** a soft drawing sound while the finger is on the letter is cheap and likely helps a little. The
useful signal is **the sound stopping** when the finger leaves the road; no buzzer is needed.

### 2.3 Too much help all the time makes learners lean on it (moderate)
- The "guidance hypothesis": feedback during every movement helps practice but can make learners depend on it,
  so they do worse once it is gone. Later reviews say this holds mostly for simple tasks with constant feedback.
  Little of it is from preschoolers.
  [a review of the guidance hypothesis](https://pmc.ncbi.nlm.nih.gov/articles/PMC3153799)

**For the app:** help should fade as a kid gets a letter right: fewer tips, a later idle hint, and later a fading
guide. A letter that was done well before starts with less help.

### 2.4 Start errorless, then let them try more on their own (moderate for the start, weak for the steps)
- Errorless methods (help that prevents mistakes, faded away) give fewer errors and faster learning in many
  studies, mostly with children with disabilities and mostly not motor tasks.
  [review of errorless learning, BehaviorWorks](https://www.behaviorworks.org/files/articles/Errorless%20Learning.pdf)
- That pulls against 1.1 (free copying teaches more). The answer in the studies is a sequence: easy and
  errorless first, then less support.

**For the app:** keep today's no-failure design (no red, no buzzer, marks just stay). Add more support at the
start (a demo the first time) and less later (section 2.3).

### 2.5 Big targets, broad drags (strong, design guidance)
- Children aged 3 to 5 need targets of at least about 2 × 2 cm, manage taps and broad drags but not precise
  ones, and can't react fast to things on screen.
  [Nielsen Norman Group, children's physical development](https://www.nngroup.com/articles/children-ux-physical-development/)

**For the app:** today's big letter, wide road and 80 px buttons fit. The tightened finish (ADR 0028) is the
risky part: the hints in this plan exist partly to get a kid over the last few percent.

---

## 3. Hints and help

### 3.1 Most help first, then fade it; wait a few seconds (moderate)
- Two prompt orders: **most-to-least** (show fully, then help less) gives fewer errors; **least-to-most** (wait,
  then add help) is sometimes faster. With a learner you don't know, a review recommends most-to-least with a
  wait that grows. [Libby et al. 2008](https://pmc.ncbi.nlm.nih.gov/articles/PMC2846579)
- **Time delay:** give the help at once at first, then wait a fixed few seconds before helping. A US guide for
  families moves to the wait after two right answers in a row at no wait; the studies use waits of about 3 to 5
  seconds. In preschoolers both orders worked; which was faster differed by child.
  [AFIRM time delay guide](https://afirm.fpg.unc.edu/sites/afirm.fpg.unc.edu/files/imce/resources/Home%20Companion%20Guide%20for%20Time%20Delay.pdf),
  [a 2021 comparison with preschoolers](https://link.springer.com/article/10.1007/s10864-020-09396-0) _(abstract)_
- No study gives a number for an app's idle hint. Our 8 seconds is a guess and probably long for this age.

**For the app:** a hint ladder. The first time a kid meets a letter, show it at once (the demo). After that,
wait about 5 seconds before the first, quiet step (the dot pulses), then step up only if nothing changes. A
letter the kid has done well twice starts at a longer wait.

### 3.2 Clever moment-by-moment help doesn't beat a simple rule (moderate)
- "Scaffolding" comes from adults tutoring 3 to 5 year olds building a block puzzle (Wood, Bruner & Ross 1976).
  The follow-up rule "help more after a miss, less after a success" (Wood, Wood & Middleton 1978) **failed a
  large preregistered replication** in 2025 with 285 three-year-olds.
  [Wood, Bruner & Ross 1976](https://pubmed.ncbi.nlm.nih.gov/932126/),
  [Smit et al. 2025](https://research-portal.uu.nl/en/publications/what-it-takes-to-tutora-preregistered-direct-replication-of-the-s/)
  _(abstract)_

**For the app:** a short, fixed ladder with a few clear triggers is enough. Don't build an adaptive tutor.

---

## 4. Praise

### 4.1 Praise what they did, not who they are; keep it honest (moderate)
- Parents who gave 1 to 3 year olds more **process praise** ("you worked hard") had children who five years later
  liked challenges more; praise of the person ("you're so smart") and the total amount predicted nothing.
  [Gunderson et al. 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3655123)
- 5 and 6 year olds praised as a person gave up more after a setback than those praised for how they did it.
  [Kamins & Dweck 1999](https://pubmed.ncbi.nlm.nih.gov/10380873/) _(abstract)_
- Over-the-top praise ("incredibly beautiful!") pushed children with low self-esteem toward easier tasks (ages 8
  to 12). [Brummelman et al. 2014](https://www.psychologicalscience.org/news/releases/when-being-called-incredibly-good-is-bad-for-children.html)

**For the app:** today's praise ("Yay!", "You did it!", "Great job!", "Wow!") is fine: none of it praises the
person. Add a few lines about what the kid did ("You went all the way!", "You kept going!"), and one for a letter
done with no hints ("All by yourself!"). Praise once per letter, never per stroke, and don't repeat the same
line twice in a row.

---

## 5. Sound and the narrator

### 5.1 Under about 3, kids follow a person, not the app (moderate)
- Teaching 2 to 5 year olds new touch gestures: **under 3, children followed only an adult showing them**;
  between 3 and 3½ they quickly became able to follow the app's spoken instructions. Picture-only prompts
  worked poorly. [Hiniker et al. 2015](https://depts.washington.edu/chilllab/?p=186) _(abstract)_
- Toddlers learn less from a demonstration on a screen than from a live one (the "video deficit"); making the
  screen respond to them helps older toddlers more than younger ones.
  [Barr 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2885850),
  [Frontiers in Psychology 2018](https://www.frontiersin.org/articles/10.3389/fpsyg.2018.02195/pdf)

**For the app:** the spoken tips and the demo are for the 3 and 4 year olds. For the youngest, the parent area
should say plainly that sitting with them and pointing is what helps most (the parent area may use text).

### 5.2 Short lines, one action each, just before it's needed (weak)
- Following spoken instructions is limited by working memory, but the studies are of 7 to 11 year olds; nothing
  sets a length for preschoolers. [Gathercole, Jaroslawska and colleagues](https://pmc.ncbi.nlm.nih.gov/articles/PMC5085979)
- When adults talk to toddlers, a lively, varied pitch helped word learning more than talking slowly.
  [Shi et al. 2022](https://repository.essex.ac.uk/34136/1/Developmental%20Science%20-%202022%20-%20Shi%20-%20Prosodic%20modulations%20in%20child%E2%80%90directed%20language%20and%20their%20impact%20on%20word%20learning.pdf)

**For the app:** every tip is one action in two to five words ("Start at the green dot."), warm with lively pitch,
said only when it's needed and never over another clip.

### 5.3 Sounds that belong to the task help; extras distract (moderate to strong)
- A meta-analysis of storybook apps for young children: sound and animation that belonged to the story helped;
  games and tappable extras pulled attention away.
  [Takacs, Swart & Bus 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4647204)
- Good learning apps are active, engaged (not distracted), meaningful and social.
  [Hirsh-Pasek et al. 2015](https://www.psychologicalscience.org/publications/educational-apps.html)

**For the app:** every new sound must mean something about the trace: drawing (on the road), a stroke done, the
letter done. No random sounds, no music under the narrator, nothing to tap for fun on the tracing screen.

---

## 6. Showing how, the first time

### 6.1 "Watch, then you try" (moderate)
- Toddlers copy what they see shown, including on a screen (Meltzoff 1988), but less well than live (5.1).
  A demo works best when the child acts straight after, in the same place.
  [a study of contingency and toddlers' learning from screens](https://pmc.ncbi.nlm.nih.gov/articles/PMC3651023)

**For the app:** a short demo: the narrator says "Watch me.", a hand traces an easy letter on the same screen
the kid will use, the narrator says "Your turn!", the start dot pulses and the kid traces the same letter. Keep it
under about 15 seconds and on the real tracing screen, not a separate video.

### 6.2 What well-regarded tracing apps do (design practice, no studies)
In general terms (no names, art or characters, ADR 0011): an animated stroke or hand shows each stroke in order;
a start dot pulses; the guide is wide and forgiving; the guide fades over repeats; a line off the path just
doesn't count, with no error sound; one celebration per letter; the letter's name or sound is said; a helper
character points. Studies of these patterns one by one weren't found, but they match 1.1, 2.3 and 4.1.

**For the app:** what we have already matches most of this. The gaps are the spoken stroke words, a fading
guide, a first-time demo, and a final "draw it beside the letter" step.

---

## 7. What the evidence does not settle
- How long to wait before a hint, and how long a spoken line can be, for 3 and 4 year olds.
- Whether a fading guide works for kids under 4.
- Whether practice on the screen carries over to paper.
- How much a drawing sound helps typical preschoolers.
- Any one letter order over another.
- What a 2 year old gets from the app alone: probably little without an adult beside them.

These are for the playtests: the plan keeps every number (waits, tries, fade steps) in one place so they can be
tuned.

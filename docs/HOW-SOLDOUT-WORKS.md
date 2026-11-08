# SoldOut: how it works and how Naive, Monid and Mobilerun power it

## The problem
Organizers of paid programs (camps, bootcamps, courses, summits) build something good and then struggle to fill seats. Ads are expensive and generic. What actually fills a room is word of mouth: the right community leader telling the right parents. That work is slow and personal, so most organizers never do enough of it.

## What SoldOut does
SoldOut is an autonomous seat-filling agent. The organizer gives it a goal ("40 seats by June"), their program content, and optionally people they already know. SoldOut then runs the whole funnel, from strategy to payment:

1. **Onboarding (2 minutes).** A conversation, one question at a time. The organizer can upload a brochure, paste links, or describe the program. SoldOut builds a program brief, spots what's missing and asks only about the gaps. The organizer chooses "I approve each step" (default) or "Fully autonomous".
2. **Strategy.** SoldOut writes a real strategy using the Good Strategy / Bad Strategy kernel: a diagnosis of why seats aren't filling, guiding policies, and the actions that follow, each with a test.
3. **Communities.** It researches communities where the audience gathers (schools, masjids, youth groups, newsletters) and gives each one a GO or NO-GO with reasons and sources.
4. **People.** Inside each GO community it finds connectors: the people who run programs, newsletters and groups. Each gets a person card: role, why them, a personal opener, and their own referral code.
5. **Outreach on every channel.** Each person is reached on all the public channels we found: email (sent automatically), a LinkedIn connection note and an Instagram DM (ready for the organizer to send). Each message points to the others: "I also reached out on LinkedIn, but wanted to try here too." People the organizer added personally (who agreed to hear from them) get a WhatsApp message directly.
6. **Conversations.** When someone replies, SoldOut keeps the conversation going like a person would: it shares a little at a time, attaches the PDF brief when they want details, and asks for one of three things: a seat for their own teen, an introduction to families, or a share in their group.
7. **Parents on WhatsApp.** Families text "JOIN" (or a connector's code) to a real WhatsApp number. SoldOut asks the fit questions, answers only from the program's own content, sends the brief or a video, and sends the enrollment link when they're ready.
8. **Paid.** Payment happens in Stripe; the webhook marks the family as paid and credits the connector who brought them.

At any moment the organizer can **take over** a conversation, **hand it back**, or **stop** the whole campaign with one switch. Anything about money terms (refunds, discounts, installments) or anything sensitive is flagged to the organizer, never improvised.

## How the three platforms fit in

| Platform | What it does inside SoldOut | Where in the funnel |
|---|---|---|
| **Naive** | The brain. Every reasoning step runs on Claude models through Naive's model proxy: onboarding questions, the brief, the strategy, GO/NO-GO decisions, picking people, writing openers, and every reply to connectors and parents. SoldOut uses a fast model for onboarding and a strong model for strategy and conversations, with automatic fallback so a dropped call never stalls the campaign. | Steps 1 to 7 |
| **Monid** | The eyes. Monid is how SoldOut learns about the world: web search to research communities and gather sources, LinkedIn search and profiles to find the connectors in each community, email finding for public work addresses, and Instagram lookups. One API key, many data providers. | Steps 3 to 5 |
| **Mobilerun** | The hands. A cloud Android phone runs a real WhatsApp account, so parents talk to a real number, not a bot API. SoldOut reads new messages, replies, and sends files (PDFs, videos) through the phone. The same phone can drive other apps (for example an assistant app connected to the organizer's Google Drive to find program videos). | Steps 5 to 7 |

Supporting pieces: AgentMail for the organizer's outreach inbox, Stripe (test mode) for payments, and a small worker that owns the phone and runs the autopilot loop.

## Why this makes real money
- **For organizers:** every filled seat is revenue they would otherwise lose. SoldOut works the channel that converts best (personal referrals) at a scale one person can't.
- **For SoldOut (proposed business model):** a success fee per seat filled, tracked end to end through referral codes and Stripe, plus an optional monthly plan for organizers running programs year-round. We get paid when the organizer gets paid.
- **First customer:** EdAI's Founder program, a paid program for Muslim teens. Same playbook fits any paid program: camps, coding bootcamps, tutoring, retreats, conferences.

## Trust built in
- Contact only people who agreed (organizer's contacts) or who reached out (JOIN). No cold WhatsApp or SMS, ever.
- Research on people uses public, professional information only; never sensitive traits or children.
- Every first email has a one-line opt-out; "no thanks" is permanent.
- Answers come only from the organizer's content. No invented numbers, quotes or testimonials.
- The organizer can approve each step, take over any conversation, or stop everything.

## The 2-minute demo path
Landing page → onboarding (upload the brief, answer two gap questions, add a contact) → strategy appears → approve → communities with GO/NO-GO → people with multi-channel openers → a parent texts JOIN on WhatsApp → fit questions, PDF, enrollment link → paid.

# Nearvana Monorepo

### ShadCn/UI and Tailwindcss v4 Monorepo, Separate Hono Backend

## Usage

in the root directory run:

```bash
pnpm install
pnpm dev
```

## Adding components

To add components to the app, run the following command at the root of the `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.


Nearvana — AI-Powered Local Discovery Platform

Overview

Nearvana is an AI-powered local discovery platform that helps people find personalized events, experiences, and activities happening nearby.

Instead of manually searching dozens of event websites, social platforms, and local forums, users receive curated recommendations tailored to their interests, lifestyle, location, and preferences.

Nearvana continuously searches public web sources for concerts, festivals, restaurant openings, nightlife, seasonal attractions, community events, and local experiences — then uses AI to transform fragmented web data into personalized recommendations through a modern, intelligent interface.

⸻

The Problem

People regularly miss events and experiences they would genuinely enjoy because local discovery is fragmented, noisy, and overwhelming.

Existing platforms often:

* prioritize advertisements and sponsored content,
* overwhelm users with irrelevant listings,
* require manual searching and filtering,
* and fail to personalize recommendations meaningfully.

As a result:

* users default to repetitive activities,
* communities lose engagement,
* and discovering meaningful experiences becomes unnecessarily difficult.

⸻

The Solution

Nearvana acts as a personalized AI-powered discovery engine.

Users provide:

* their location,
* travel preferences,
* interests,
* favorite cuisines,
* music genres,
* lifestyle preferences,
* and preferred activity “vibes.”

The platform then:

1. Searches the web for nearby experiences and events
2. Aggregates and structures unorganized event data
3. Uses AI to categorize, summarize, and rank events
4. Delivers curated recommendations through a clean modern interface

The result is a personalized feed of experiences users are actually likely to enjoy.

⸻

Core Features

Personalized Recommendations

Tailored discovery based on:

* hobbies
* cuisines
* music preferences
* lifestyle interests
* travel tolerance
* historical engagement
* behavioral signals

⸻

AI-Powered Event Aggregation

Automatically discovers:

* concerts
* festivals
* parades
* restaurant openings
* comedy shows
* sporting events
* nightlife
* fairs
* farmers markets
* conventions
* community events
* seasonal attractions

⸻

Intelligent Ranking System

Events are ranked using:

* user preferences
* proximity
* popularity
* engagement history
* event category affinity
* time/day preferences

⸻

Weekly Discovery Digest

Users receive curated recommendations such as:

* “Best Date Night Events This Weekend”
* “Top Food Events Nearby”
* “Trending Activities Within 30 Minutes”

⸻

Modern Discovery Interface

Features include:

* event cards
* personalized feeds
* saved events
* maps integration
* recommendation explanations
* category filtering
* future collaborative planning

⸻

Product Philosophy

Nearvana is intentionally designed around:

* practical AI orchestration,
* deterministic pipelines,
* and scalable engineering systems.

The platform avoids over-engineered autonomous AI systems and instead focuses on:

* reliable discovery,
* structured extraction,
* ranking,
* summarization,
* and personalization.

AI is used where it provides genuine value:

* understanding messy web content,
* structuring data,
* summarizing information,
* and improving recommendation quality.

⸻

High-Level Architecture

Scheduler / Cron Jobs
        ↓
Search APIs & Scraping
        ↓
Raw Event Content
        ↓
AI Extraction & Structuring
        ↓
Deduplication & Ranking
        ↓
PostgreSQL Storage
        ↓
Frontend & Mobile Clients

⸻

Monorepo Architecture

Nearvana is built as a Turborepo monorepo to support:

* shared TypeScript packages,
* scalable backend services,
* shared validation schemas,
* mobile expansion,
* and long-term maintainability.

The architecture separates:

* frontend applications,
* backend APIs,
* shared libraries,
* and infrastructure concerns.

⸻

Repository Structure

apps/
  web/           → Next.js frontend
  api/           → Hono backend API
  mobile/        → Future React Native / Expo app
packages/
  ui/            → Shared UI components
  db/            → Database schema & Drizzle ORM
  types/         → Shared TypeScript types
  ai/            → AI workflows & prompts
  config/        → Shared configs

⸻

Technology Stack

Frontend

Web Application

* Next.js￼
* React￼
* TypeScript￼
* Tailwind CSS￼

UI Components

Recommended:

* shadcn/ui￼

⸻

Backend

API Framework

* Hono￼

Runtime

* Node.js

Language

* TypeScript

Database

* PostgreSQL￼

ORM

Recommended:

* Drizzle ORM￼

⸻

AI & Search

LLM Provider

* OpenAI

Recommended Models

* gpt-4.1-mini
* gpt-4.1

Used for:

* event extraction
* categorization
* summarization
* ranking
* personalization
* structured outputs

⸻

Search & Crawling

* Tavily￼
* Firecrawl￼

⸻

Infrastructure

Deployment

* Vercel￼

Scheduling

* Vercel Cron Jobs

Database Hosting

* PostgreSQL-compatible provider

⸻

AI Workflow

Nearvana does not treat LLMs as the source of truth.

Instead:

* public web content provides raw event information,
* while AI transforms unstructured content into usable recommendations.

The AI layer handles:

* extraction,
* summarization,
* categorization,
* deduplication,
* ranking,
* and personalization.

⸻

Example Event Object

{
  "title": "Summer Jazz Festival",
  "date": "2026-07-12",
  "location": "Salt Lake City, UT",
  "category": "Music",
  "summary": "Outdoor jazz festival featuring local and national artists.",
  "distanceMiles": 12,
  "score": 0.91
}

⸻

Future Mobile Expansion

The monorepo architecture is intentionally designed to support a future mobile application with minimal backend changes.

Planned mobile stack:

* React Native
* Expo
* Shared API contracts
* Shared validation schemas
* Shared business logic packages

This allows Nearvana to maintain:

* one backend,
* one shared type system,
* and one scalable architecture across platforms.

⸻

Engineering Goals

Nearvana is designed to demonstrate:

* scalable full-stack architecture,
* practical AI engineering,
* structured LLM workflows,
* web data pipelines,
* personalization systems,
* and modern cloud-native development.

The platform combines:

* traditional software engineering,
* AI orchestration,
* and product-focused UX design.

⸻

Vision

Nearvana aims to become:

a personalized AI-powered lifestyle discovery platform that helps people uncover meaningful real-world experiences nearby.

Rather than overwhelming users with infinite options, Nearvana focuses on:

* relevance,
* personalization,
* and actionable recommendations that encourage real-world engagement.

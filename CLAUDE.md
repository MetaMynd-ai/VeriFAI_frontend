# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
- `npm start` - Start development server on localhost:4201 with host 0.0.0.0 and disabled host check
- `ng build` - Build the application for production (outputs to `dist/fuse`)
- `ng build --watch --configuration development` - Build in watch mode for development
- `ng test` - Run unit tests using Karma and Jasmine

### Angular CLI
- `ng generate component component-name` - Generate new component
- `ng generate directive|pipe|service|class|guard|interface|enum|module` - Generate other Angular artifacts

## Architecture Overview

### Project Structure
This is an Angular 19 application built on the **Fuse Admin Template** framework. The project follows a modular architecture with the following key organizational patterns:

#### Core Architecture
- **@fuse/** - Custom framework components and utilities including:
  - Animations, components (alert, card, drawer, navigation), directives, services
  - Tailwind CSS theming system and custom utilities
  - Mock API system for development
- **src/app/core/** - Core application services and providers:
  - `agent/` - Smart agent management services and interfaces
  - `auth/` - Authentication services, guards, and interceptors
  - `user/` - User management and profile services
  - `navigation/` - Application navigation configuration
- **src/app/layout/** - Layout components and common UI elements
- **src/app/modules/** - Feature modules organized by domain:
  - `admin/app/agents/` - Smart agent management features
  - `auth/` - Authentication flows (sign-in, sign-up, reset password)
  - `landing/` - Landing page components

#### Smart Agent System
The application centers around a smart agent management system:

- **Agent Management**: Create, configure, and manage AI agents with DID (Decentralized Identity) support
- **Blockchain Integration**: Agents have blockchain accounts (Hedera Hashgraph) with balance tracking
- **Agent Types**: Different agent categories (automation, communication, etc.) with specific capabilities
- **Profile System**: Comprehensive agent profiles including VC (Verifiable Credentials) issuance

#### Key Technologies
- **Angular 19** with standalone components architecture
- **Angular Material 19** for UI components
- **Tailwind CSS** with custom theming system
- **Perfect Scrollbar** for custom scrollbars
- **ApexCharts** for data visualization
- **Quill Editor** for rich text editing
- **Transloco** for internationalization (English/Turkish support)

#### Styling and Theming
- Uses a sophisticated Tailwind-based theming system in `src/@fuse/tailwind/`
- SCSS preprocessing with custom utility classes
- Dark/light theme support built into the Fuse framework
- Custom icon integration system supporting multiple icon sets

#### Mock API System
Development uses a comprehensive mock API system (`src/app/mock-api/`) providing:
- Agent data and operations
- User authentication flows  
- Dashboard analytics data
- Application state management

#### Environment Configuration
- Development: `src/environments/environment.ts`
- Production: `src/environments/environment.prod.ts`
- Build configurations in `angular.json` with development as default

When working with this codebase, follow the existing modular patterns, use the Fuse component system for UI consistency, and ensure new features integrate properly with the agent management core functionality.
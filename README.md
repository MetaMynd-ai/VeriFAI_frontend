# VeriFAI - AI-Driven Hedera-Backed Agent System
**Powered by MetaMynd.ai**

🌐 **Live System**: [https://verifai.metamynd.ai/](https://verifai.metamynd.ai/)

A cutting-edge platform for creating, managing, and deploying AI-driven smart agents powered by Hedera blockchain technology. This system enables users to build autonomous agents with verifiable credentials, decentralized identities, and blockchain-backed trust mechanisms.

## 🌟 Features

- **AI-Driven Smart Agents**: Create intelligent agents with customizable capabilities and purposes
- **Hedera Blockchain Integration**: Leverage Hedera's fast, secure, and eco-friendly distributed ledger
- **Decentralized Identity (DID)**: Each agent receives a unique DID for verifiable identity
- **Verifiable Credentials**: Issue and manage VCs for agent authentication and trust
- **Multi-Step Agent Creation**: Streamlined wizard for wallet creation, DID issuance, profile setup, and VC generation
- **Responsive Design**: Mobile-first design with adaptive stepper UI for all device sizes
- **Real-time Management**: Monitor agent status, capabilities, and blockchain interactions

## 🏗️ Architecture

The platform is built on Angular with the following key components:

- **Agent Management System**: Complete CRUD operations for smart agents
- **Hedera Wallet Integration**: Automated wallet creation and management
- **DID Service**: Decentralized identity issuance and verification
- **VC Management**: Verifiable credential creation and validation
- **Blockchain Service**: Direct integration with Hedera network
- **HSuite Smart Node Backend**: Robust backend infrastructure powering agent operations and blockchain interactions

## 🚀 Technology Stack

- **Frontend**: Angular 17+ with Standalone Components
- **Backend**: HSuite Smart Node - Advanced backend infrastructure for blockchain operations
- **UI Framework**: Angular Material with custom Tailwind CSS styling
- **Blockchain**: Hedera Hashgraph
- **State Management**: RxJS for reactive data flow
- **Responsive Design**: Angular CDK Layout with breakpoint observers

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) and enhanced for blockchain integration

## 💻 Development

### Prerequisites
- Node.js (v18 or higher)
- Angular CLI (latest version)
- Access to Hedera testnet/mainnet

### Installation
```bash
npm install
```

### Environment Setup
Configure your environment variables for Hedera integration:
```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  hederaNetwork: 'testnet', // or 'mainnet'
  // Add your Hedera configuration here
};
```

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## 🏃‍♂️ Running the Application

### Development Mode
```bash
ng serve
```
The app will be available at `http://localhost:4200/`

### Production Build
```bash
ng build --configuration production
```

## 🧪 Testing

## 🧪 Testing

### Unit Tests
```bash
ng test
```
Run unit tests via [Karma](https://karma-runner.github.io).

### End-to-End Tests
```bash
ng e2e
```
Execute end-to-end tests via a platform of your choice.

## 🏗️ Code Generation

Generate new components, services, or other Angular artifacts:
```bash
ng generate component component-name
ng generate service service-name
ng generate directive|pipe|service|class|guard|interface|enum|module
```

## 📱 Agent Creation Workflow

1. **Agent Profile Setup**: Define agent name, description, purpose, and capabilities
2. **Hedera Wallet Creation**: Automatically generate a new Hedera wallet for the agent
3. **DID Issuance**: Create a decentralized identity for the agent
4. **Profile Registration**: Store agent profile on the blockchain
5. **VC Generation**: Issue verifiable credentials for the agent
6. **Agent Activation**: Deploy the agent for active use

## 🎯 Agent Capabilities

The platform supports various agent types with capabilities including:

- **Travel & Booking**: Flight search, hotel booking, car rental, itinerary management
- **Personal Assistant**: Customer support, personal task management
- **Social Media**: Social media management and automation
- **Crypto & Finance**: Trading, wallet management, asset analytics, transactions
- **Content Creation**: Text, image, audio, video, and code generation
- **Language Services**: Translation, summarization, content extraction
- **Data & Analytics**: Knowledge retrieval, data integration, visualization
- **Security & Compliance**: Fraud detection, security monitoring, regulatory analysis
- **Workflow Automation**: API integration, multi-agent coordination

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software developed by MetaMynd.ai. All rights reserved.

## 🆘 Support

For support and questions:
- Visit our platform: [https://verifai.metamynd.ai/](https://verifai.metamynd.ai/)
- Create an issue in this repository
- Contact the MetaMynd.ai development team
- Check the documentation in the `/docs` directory

## 🏢 About MetaMynd.ai

VeriFAI is proudly developed by MetaMynd.ai, a leading provider of AI-driven blockchain solutions. We specialize in creating intelligent, verifiable, and decentralized systems that bridge the gap between artificial intelligence and blockchain technology.

Learn more about our other products and services at [MetaMynd.ai](https://metamynd.ai)

## 📚 Further Resources

- [Angular CLI Documentation](https://angular.io/cli)
- [Hedera Documentation](https://docs.hedera.com/)
- [Angular Material Documentation](https://material.angular.io/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

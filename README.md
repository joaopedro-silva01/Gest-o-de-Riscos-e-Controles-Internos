<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1GFSAN3eDXgqrie7a4cvB1HB-7G1UaNYp

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Módulo: Governança e Segurança da IA

Acessível pelo item **Governança da IA** do menu lateral do painel. Código em `modules/ai-governance/`
e arquitetura em [`docs/governanca-ia/ARQUITETURA.md`](docs/governanca-ia/ARQUITETURA.md).

- Dados **fictícios** de demonstração são carregados na primeira execução (armazenados no navegador, chave `cicllos_aigov_db`).
- Use **"Simular perfil"** (rodapé do menu do módulo) para ver o sistema como Administrador, Gestor, Auditor, Diretoria ou Colaborador.
- Testes das regras de negócio: `npm test` · Verificação de tipos: `npm run typecheck`

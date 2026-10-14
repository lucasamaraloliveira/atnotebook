# Rastreamento Encadeado em 3 Níveis (Pasta › Subpasta › Sub-subpasta)

Implementação da descoberta e extração recursiva de páginas web até o 3º nível de encadeamento hierárquico, permitindo mapear pastas raízes, subpastas diretas e sub-subpastas vinculadas, com visualização em árvore estruturada e controle de limite de segurança.

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisões confirmadas com o usuário na Fase 1 de planejamento:

- **Profundidade de Encadeamento**: Nível 3 fixo (Pasta Raiz L1 › Subpastas L2 › Sub-subpastas L3).
- **Estrutura Visual no Modal**: Apresentação visual em árvore hierárquica com recuo proporcional por nível, guias verticais de conexão e identificadores de parentesco.
- **Controle de Performance e Cota**: Limite inicial de até 150 páginas coletadas com mecanismo para carregar páginas adicionais se houver mais links no portal.

---

## 1. Overview & Core Concept

- **O que faz**:
  Atualmente, o rastreador web (Smart Crawl) analisa a página inicial (Nível 1) e descobre links diretamente referenciados por ela (Nível 2). Com esta atualização, o mecanismo passa a navegar de forma encadeada e assíncrona para dentro de cada subpasta (Nível 2) encontrada, explorando os links internos específicos de cada uma para descobrir as sub-subpáginas (Nível 3).
- **Público & Caso de Uso**:
  Documentações técnicas complexas, portais jurídicos, wikis e sites institucionais onde o conteúdo rico está aninhado em tópicos profundos (ex: `/docs/` → `/docs/api/` → `/docs/api/endpoints/v1/auth`).
- **Valor Principal**:
  Garante que nenhuma documentação essencial fique de fora ao importar uma pasta inteira, mantendo a árvore de páginas organizada e com prevenção total de URLs duplicadas.

---

## 2. User Experience & Visual Design

### Fluxo de Uso
1. **Disparo do Mapeamento**:
   O usuário insere a URL da pasta ou site e clica em **"Mapear Páginas Vinculadas"**.
2. **Processamento em Etapas (Feedback em Tempo Real)**:
   - Etapa 1: Ingestão da Pasta Raiz (Nível 1).
   - Etapa 2: Mapeamento das Subpastas diretas (Nível 2).
   - Etapa 3: Rastreamento encadeado das Sub-subpastas (Nível 3) com indicador de progresso e páginas encontradas.
3. **Apresentação em Árvore Hierárquica**:
   - Cada linha na lista exibe sua profundidade:
     - **Nível 1 (Pasta)**: Destaque com ícone de pasta raiz `FolderArchive` ou `Globe`, cor azul primário.
     - **Nível 2 (Subpasta)**: Recuo visual de 16px, ícone `FolderTree`, badge `Nível 2 (Subpasta)`, linha guia lateral conectada.
     - **Nível 3 (Sub-subpasta)**: Recuo visual de 32px, ícone `CornerDownRight` ou `FileText`, badge esmeralda/violeta `Nível 3 (Sub-subpasta)`.
   - Breadcrumb inline demonstrando a linhagem: `docs › api › endpoints`.
   - Seletor em cascata: selecionar uma subpasta permite marcar/desmarcar suas sub-subpáginas filhas em lote.
4. **Contador e Resumo de Camadas**:
   - Barra superior detalhando a contagem por nível: `1 Raiz • X Subpastas • Y Sub-subpastas (Total: Z páginas)`.
   - Botão **"Carregar Mais Páginas"** quando o site possuir mais de 150 links mapeáveis.
5. **Ingestão Integral Garantida**:
   - Ao confirmar a seleção, o download do texto verbatim continua 100% completo, associando opcionalmente à seção selecionada no caderno.

---

## 3. Key Product Decisions & Trade-Offs

### Decisão 1: Arquitetura de Coleta Recursiva Concorrente vs Sequencial
- **Abordagem Escolhida**: Concorrência controlada em lote (`Promise.allSettled` com grupos de 6 a 8 requisições simultâneas e timeout de 6s por subpágina).
- **Por que**: Evita travamento da rota de API caso alguma subpágina tenha latência alta ou falha de DNS, garantindo retorno rápido da árvore até o limite de 150 itens.
- **Alternativas Consideradas**: 
  - *Sequencial simples*: excessivamente lento para sites com dezenas de subpastas.
  - *Crawling irrestrito sem batching*: risco de estouro de cota e bloqueio por rate-limit do servidor de origem.

### Decisão 2: Relação de Parentesco e Agrupamento em Árvore
- **Abordagem Escolhida**: Cada página descoberta armazena `depth` (1, 2 ou 3), `parentId`, `parentUrl` e `pathSegments`. A ordenação na interface preserva a vizinhança lógica (a sub-subpasta é renderizada imediatamente após sua subpasta correspondente).
- **Por que**: Proporciona legibilidade natural imediata para o usuário sem que ele precise ficar deduzindo a qual pasta pertence cada subpágina profunda.

### Decisão 3: Deduplicação Multi-Nível
- **Abordagem Escolhida**: Rastreamento centralizado com `Set` normalizado de URLs visitadas. Links que reaparecem em múltiplos níveis ou já constam no caderno ativo são identificados e desabilitados de seleção com o badge de duplicata existente.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SmartCrawlModal (UI)                            │
│  - Input de URL raiz / pasta inicial                                   │
│  - Resumo de métricas: L1 (Raiz) | L2 (Subpastas) | L3 (Sub-subpastas) │
│  - Árvore hierárquica com recuo CSS, linhas guia e badges de nível     │
│  - Ações em cascata (selecionar subpasta e subpáginas filhas)          │
│  - Botão de Paginação/Carregar Mais (limite inicial de 150)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ POST /api/crawl-url
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    API Route (/api/crawl-url)                          │
│                                                                        │
│  1. FETCH L1: Download da página raiz/pasta inicial                    │
│     - Extração de HTML, links locais e sitemap                         │
│                                                                        │
│  2. ENFILEIRAMENTO L2: Identificação de subpastas/subpáginas diretas   │
│     - Normalização de URLs e deduplicação                              │
│                                                                        │
│  3. RECURSÃO L3 (ENCADEAMENTO):                                        │
│     - Batch fetch concorrente das páginas de L2                        │
│     - Extração dos links internos de cada subpasta (L3)                │
│     - Associação de parentId e depth: 3                                │
│     - Respeito ao teto de 150 páginas por lote                         │
│                                                                        │
│  4. ENRIQUECIMENTO & DEDUPLICAÇÃO:                                     │
│     - Validação contra existingUrls do caderno                         │
│     - Geração de metadados hierárquicos e títulos limpos               │
└────────────────────────────────────────────────────────────────────────┘
```

### Modificações de Estrutura de Dados
- Estender `DiscoveredPage`:
  ```ts
  interface DiscoveredPage {
    id: string;
    url: string;
    title: string;
    summary: string;
    content: string;
    wordCount: number;
    charCount: number;
    selected: boolean;
    hasFullContent?: boolean;
    isDuplicate?: boolean;
    duplicateReason?: string;
    depth: 1 | 2 | 3;           // Nível 1 (raiz), 2 (subpasta), 3 (sub-subpasta)
    parentId?: string;          // ID do item pai
    parentUrl?: string;         // URL do pai direto
    childCount?: number;        // Quantidade de sub-subpáginas filhas
  }
  ```

---

## 5. Plano de Execução em Fases

1. **Backend (`/app/api/crawl-url/route.ts`)**:
   - Implementar função de descoberta recursiva encadeada em 3 níveis com `batchFetch` concorrente e timeout seguro.
   - Definir mapeamento de `depth: 1 | 2 | 3`, `parentId` e identificação da linhagem da URL.
   - Respeitar o limite de 150 páginas com flag indicando se há mais páginas pendentes no site.
   - Manter compatibilidade com a ingestão integral `fetch-contents`.

2. **Interface do Usuário (`/components/SmartCrawlModal.tsx`)**:
   - Criar componente de exibição em árvore com recuos visuais dinâmicos (`pl-3` para L2, `pl-8` para L3), guias de linha de conexão e badges temáticas.
   - Adicionar resumo de contagem segmentada (Pastas L1, Subpastas L2, Sub-subpastas L3).
   - Implementar seleção/deseleção em lote com opção de marcar filhos ao selecionar pasta pai.
   - Adicionar botão "Carregar mais subpáginas" quando exceder o limite de 150.

3. **Verificação & Testes**:
   - Testar rotas e páginas com estrutura aninhada de pastas.
   - Executar validação de tipos TypeScript com `lint_applet` e build com `compile_applet`.

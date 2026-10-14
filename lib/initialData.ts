import { Notebook } from './types';
import { computeTextMetrics } from './integrity';

const source1Content = `Manual Operacional e Normas - Modalidade Recepção:
1. O fluxo de acolhimento ao visitante ou cliente deve seguir as diretrizes de triagem rápida e conferência de credenciais.
2. Todo atendimento deve ser registrado em sistema com horário de entrada, documento de identificação e encaminhamento ao departamento competente.
3. Em situações de alta demanda, a equipe de recepção deve priorizar casos emergenciais e notificar os gestores de área imediatamente.
4. O protocolo de segurança estipula que crachás de visitantes temporários devem ser recolhidos na catraca de saída.`;

const source2Content = `Diretrizes de Conformidade e Autonomia Documental:
1. Nenhuma dependência crítica deve impedir o compartilhamento de pesquisas consolidadas entre equipes multidisciplinares.
2. A ingestão manual controlada e por sessões assegura conformidade com políticas de privacidade e evita integrações cegas por API que possam violar licenças.
3. Cada fonte migrada deve registrar data, hash de integridade, contagem de caracteres e palavras para garantir que nada foi perdido.
4. O motor de IA associado deve operar com citações explícitas por parágrafo, permitindo auditoria humana instantânea.`;

const source3Content = `Anotações Estratégicas da Reunião de Engenharia de Dados:
- A decisão de criar uma ferramenta alternativa ao Gemini Notebook decorreu diretamente do anúncio de restrições de compartilhamento de cadernos com fontes externas.
- Usuários externos e parceiros comerciais ficavam impossibilitados de acessar notebooks colaborativos quando estes usavam links ou fontes de fora da conta Google do criador.
- Metas adicionais atendidas:
  a) Organização de fontes por sessões/pastas temáticas (ex: Modalidade Recepção) com ícones customizáveis;
  b) Permissão refinada de leitor (apenas faz perguntas e consulta) com aprovação do proprietário para edição;
  c) Suporte completo a Dark Mode e interface fluida e responsiva.`;

const s1Metrics = computeTextMetrics(source1Content);
const s2Metrics = computeTextMetrics(source2Content);
const s3Metrics = computeTextMetrics(source3Content);

export const DEFAULT_NOTEBOOKS: Notebook[] = [
  {
    id: 'nb-recepcao-01',
    title: 'Manual de Operações & Recepção',
    description: 'Caderno estruturado com fontes organizadas por seções temáticas e permissões de acesso.',
    emoji: '🏨',
    createdAt: '2026-10-09T08:00:00.000Z',
    updatedAt: '2026-10-09T08:00:00.000Z',
    ownerEmail: 'lucas.amaral.oliveira.silva@gmail.com',
    sections: [
      {
        id: 'sec-recepcao',
        name: 'Modalidade Recepção',
        icon: '🛎️',
        description: 'Fluxos de triagem, atendimento e segurança presencial',
        color: '#3b82f6',
        createdAt: '2026-10-09T08:00:00.000Z',
      },
      {
        id: 'sec-governanca',
        name: 'Governança & Conformidade',
        icon: '⚖️',
        description: 'Políticas corporativas e normas de compartilhamento',
        color: '#8b5cf6',
        createdAt: '2026-10-09T08:00:00.000Z',
      },
    ],
    sources: [
      {
        id: 'src-1',
        title: 'Manual Operacional de Atendimento',
        type: 'document',
        sectionId: 'sec-recepcao',
        originalOrigin: 'Norma Interna - Modalidade Recepção v3.1',
        content: source1Content,
        summary: 'Diretrizes de acolhimento, credenciamento e triagem presencial.',
        charCount: s1Metrics.charCount,
        wordCount: s1Metrics.wordCount,
        estimatedTokens: s1Metrics.estimatedTokens,
        checksum: s1Metrics.checksum,
        migratedAt: '2026-10-09T08:15:00.000Z',
        verified: true,
        notes: 'Protocolo ativo da recepção.',
        enabled: true,
      },
      {
        id: 'src-2',
        title: 'Diretrizes de Conformidade e Autonomia',
        type: 'document',
        sectionId: 'sec-governanca',
        originalOrigin: 'Documento de Políticas Internas v2.4',
        content: source2Content,
        summary: 'Princípios de autonomia documental, auditoria humana e rastreabilidade por checksum.',
        charCount: s2Metrics.charCount,
        wordCount: s2Metrics.wordCount,
        estimatedTokens: s2Metrics.estimatedTokens,
        checksum: s2Metrics.checksum,
        migratedAt: '2026-10-09T08:30:00.000Z',
        verified: true,
        notes: 'Verificado checksum com o original.',
        enabled: true,
      },
      {
        id: 'src-3',
        title: 'Anotações da Reunião de Engenharia',
        type: 'transcript',
        sectionId: 'sec-governanca',
        originalOrigin: 'Ata de Decisão Técnica',
        content: source3Content,
        summary: 'Substituição do Gemini Notebook, suporte a sessões e permissão leitor.',
        charCount: s3Metrics.charCount,
        wordCount: s3Metrics.wordCount,
        estimatedTokens: s3Metrics.estimatedTokens,
        checksum: s3Metrics.checksum,
        migratedAt: '2026-10-09T08:45:00.000Z',
        verified: true,
        notes: 'Reunião técnica.',
        enabled: true,
      },
    ],
    chatHistory: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Como funciona o protocolo da sessão Modalidade Recepção?',
        timestamp: '2026-10-09T09:00:00.000Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: `Na sessão **Modalidade Recepção**, o atendimento obedece a regras de triagem e segurança bem definidas [Fonte: Manual Operacional de Atendimento]:

1. **Acolhimento e Credenciais:** O fluxo exige triagem rápida e conferência rigorosa de credenciais de visitantes.
2. **Registro Obrigatório:** Todo atendimento registra horário de entrada, documento de identidade e setor de destino.
3. **Casos Emergenciais:** Em momentos de sobrecarga, a recepção prioriza urgências e avisa gestores imediatamente.
4. **Recolhimento de Crachás:** Crachás de visitantes temporários devem ser obrigatoriamente devolvidos na catraca de saída.`,
        timestamp: '2026-10-09T09:01:00.000Z',
        citations: [
          {
            sourceId: 'src-1',
            sourceTitle: 'Manual Operacional de Atendimento',
            snippet: 'O fluxo de acolhimento ao visitante ou cliente deve seguir as diretrizes de triagem rápida...',
          },
        ],
        groundedSourcesCount: 1,
      },
    ],
    chatSessions: [
      {
        id: 'session-initial-1',
        notebookId: 'nb-recepcao-01',
        title: 'Protocolo da sessão Modalidade Recepção',
        createdAt: '2026-10-09T09:00:00.000Z',
        updatedAt: '2026-10-09T09:01:00.000Z',
        actionType: 'question',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Como funciona o protocolo da sessão Modalidade Recepção?',
            timestamp: '2026-10-09T09:00:00.000Z',
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: `Na sessão **Modalidade Recepção**, o atendimento obedece a regras de triagem e segurança bem definidas [Fonte: Manual Operacional de Atendimento]:\n\n1. **Acolhimento e Credenciais:** O fluxo exige triagem rápida e conferência rigorosa de credenciais de visitantes.\n2. **Registro Obrigatório:** Todo atendimento registra horário de entrada, documento de identidade e setor de destino.\n3. **Casos Emergenciais:** Em momentos de sobrecarga, a recepção prioriza urgências e avisa gestores imediatamente.\n4. **Recolhimento de Crachás:** Crachás de visitantes temporários devem ser obrigatoriamente devolvidos na catraca de saída.`,
            timestamp: '2026-10-09T09:01:00.000Z',
            citations: [
              {
                sourceId: 'src-1',
                sourceTitle: 'Manual Operacional de Atendimento',
                snippet: 'O fluxo de acolhimento ao visitante ou cliente deve seguir as diretrizes de triagem rápida...',
              },
            ],
            groundedSourcesCount: 1,
          },
        ],
      },
      {
        id: 'session-initial-2',
        notebookId: 'nb-recepcao-01',
        title: 'Conformidade e Autonomia Documental',
        createdAt: '2026-10-09T08:35:00.000Z',
        updatedAt: '2026-10-09T08:36:00.000Z',
        actionType: 'analysis',
        messages: [
          {
            id: 'msg-3',
            role: 'user',
            content: 'Qual o objetivo da autonomia documental e auditoria por checksum?',
            timestamp: '2026-10-09T08:35:00.000Z',
          },
          {
            id: 'msg-4',
            role: 'assistant',
            content: 'A autonomia documental garante que nenhuma equipe fique dependente de APIs cegas ou plataformas fechadas, validando a integridade das fontes via checksum.',
            timestamp: '2026-10-09T08:36:00.000Z',
          },
        ],
      },
      {
        id: 'session-initial-3',
        notebookId: 'nb-recepcao-01',
        title: 'Resumo das Decisões de Engenharia',
        createdAt: '2026-10-09T08:50:00.000Z',
        updatedAt: '2026-10-09T08:51:00.000Z',
        actionType: 'summary',
        messages: [
          {
            id: 'msg-5',
            role: 'user',
            content: 'Resuma os motivos da substituição do Gemini Notebook',
            timestamp: '2026-10-09T08:50:00.000Z',
          },
          {
            id: 'msg-6',
            role: 'assistant',
            content: 'A decisão decorreu das restrições de compartilhamento do Gemini Notebook com usuários externos, criando a necessidade de um caderno autônomo com suporte a seções e permissões flexíveis.',
            timestamp: '2026-10-09T08:51:00.000Z',
          },
        ],
      },
    ],
    notes: [
      {
        id: 'note-1',
        title: 'Checklist da Recepção Matutina',
        content: 'Confirmar suprimentos de crachás temporários e verificar alinhamento da equipe com a triagem rápida.',
        sectionId: 'sec-recepcao',
        createdAt: '2026-10-09T09:10:00.000Z',
      },
    ],
    shareSettings: {
      isPubliclyShared: true,
      defaultRole: 'viewer',
      allowReaderChat: true,
      requiresOwnerApprovalForEdit: true,
      shareCode: 'omni-recepcao-774',
      ownerEmail: 'lucas.amaral.oliveira.silva@gmail.com',
    },
  },
];

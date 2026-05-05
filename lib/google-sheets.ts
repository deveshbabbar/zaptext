// ─── Legacy import surface (now Neon-backed) ───
//
// This file used to wrap the Google Sheets API for three logical tables —
// clients, conversations, analytics. As of the Neon migration (Phase 2A)
// the actual implementations live in lib/db/{clients,conversations,analytics}.ts
// and this file re-exports them so the 23 callers across the codebase don't
// need to change their imports yet.
//
// We can rename the imports to `@/lib/db/...` over time; doing it in one
// pass here would have made the Phase 2A diff sprawl across every API
// route. Easier to leave the import alias intact and clean up later.

export {
  DuplicateBotError,
  getAllClients,
  getClientById,
  getClientByPhoneNumberId,
  addClient,
  deleteClient,
  updateClientStatus,
  updateClientFields,
  updateClientField,
} from './db/clients';

export {
  getConversationHistory,
  addConversationMessage,
  getClientConversations,
  hasRecentInboundMessage,
  getOutboundCountThisMonth,
  getOutboundCountForOwner,
} from './db/conversations';

export {
  updateAnalytics,
  getClientAnalytics,
} from './db/analytics';

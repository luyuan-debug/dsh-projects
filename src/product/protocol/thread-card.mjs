export const REQUEST_RECORD = 'plugin:dsh-project-threads/resource-request';
export const LOCAL_RECORD = 'plugin:dsh-project-threads/local-intent';
export const LINK_RECORD = 'plugin:dsh-project-threads/thread-link';
export const isHumanUserEvent = event => event.type === 'user/message' && event.data?.source?.kind === 'user';
/** A message owns its Context from the ORIGINAL user event; later plugin records only update that Context. */
export const threadCardDefinition = {
  kind: 'project-thread-cards', target: 'chat',
  match(event) {
    if (isHumanUserEvent(event)) return { id: String(event.data.id), role: 'start' };
    if(event.type===REQUEST_RECORD&&event.ignorable===true&&event.data?.messageId)return {id:event.data.messageId,role:'update'};
    if(event.type===LOCAL_RECORD&&event.ignorable===true&&event.data?.messageId)return {id:event.data.messageId,role:'update'};
    if (event.type === LINK_RECORD && event.ignorable === true && event.data?.association?.messageId) return { id: event.data.association.messageId, role: 'update' };
    return null;
  },
  start(_context, match) { return { messageId: match.event.data.id, messageSeq: match.event.seq, links: {} }; },
  update(context, match) {
    if(!context.state)return context.state;
    if(match.event.type===REQUEST_RECORD){const d=match.event.data;return d.messageId===context.state.messageId?{...context.state,request:{projectId:d.projectId,requestId:d.requestId}}:context.state;}
    if(match.event.type===LOCAL_RECORD){const d=match.event.data;if(d.messageId===context.state.messageId&&d.messageSeq===context.state.messageSeq)return {...context.state,localIntent:{executionKind:'local'}};return context.state;}
    if(match.event.type!==LINK_RECORD)return context.state;
    const link = match.event.data.association;
    if (link.messageId !== context.state.messageId || link.messageSeq !== context.state.messageSeq || !Number.isInteger(link.version) || link.version < 1) return context.state;
    const previous = context.state.links[link.threadId];
    if (previous && previous.version >= link.version) return context.state;
    return { ...context.state, links: { ...context.state.links, [link.threadId]: link } };
  },
  buildViewNode(context) {
    if (!context.state || Object.keys(context.state.links).length === 0&&!context.state.localIntent&&!context.state.request) return null;
    return { key: context.key, kind: 'project-thread-cards', id: context.id, target: 'chat', anchorSeq: context.state.messageSeq + 0.01, location: context.start?.location ?? { kind: 'unresolved' }, groupTree: 'input', visibility: 'visible', data: context.state };
  },
};

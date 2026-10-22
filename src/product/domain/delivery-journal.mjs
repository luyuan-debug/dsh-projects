import { copy, fail } from './projects.mjs';
/** Per-key short transactions; independent model turns never wait in this queue. */
export class DeliveryJournal {
  constructor({table,persistence,agentFor}){Object.assign(this,{table,persistence,agentFor});this.locks=new Map();}
  serial(key,op){const p=(this.locks.get(key)??Promise.resolve()).then(op),tail=p.then(()=>{},()=>{});this.locks.set(key,tail);void tail.then(()=>{if(this.locks.get(key)===tail)this.locks.delete(key)});return p;}
  deliver(key,record){return this.serial(key,async()=>{
    let row=this.table.get(key);
    if(!row){row={...copy(record),delivery:'prepared'};await this.table.put(key,row);}
    if(['accepted','integrated'].includes(row.delivery))return copy(row);
    const agent=await this.agentFor(row.sessionId);
    await this.persistence.flush();
    const events=agent.session.snapshotEvents();
    const seen=events.some(e=>e.type==='user/message'&&e.data.id===row.message.id || e.type==='agent/inbox/spliced'&&e.data.inserted?.some(m=>m.id===row.message.id));
    if(!seen){
      // Sync durable append occurs inside followup. If flush/ack fails, recovery checks the same message ID.
      agent.followup(copy(row.message));
      await this.persistence.flush();
    }
    row={...row,delivery:'accepted',acceptedAt:Date.now()};await this.table.put(key,row);return copy(row);
  });}
  async recover(){for(const [key,row]of this.table.entries())if(row.delivery==='prepared')await this.deliver(key,row);}
  async close(){while(this.locks.size)await Promise.all([...this.locks.values()]);}
}

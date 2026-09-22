import {describeGrowthStop,type FillReport} from '@meshtailor/uv';

/** Shared DOM renderer. Only textContent is used for report data. */
export function renderFillGrowth(host:HTMLElement,report:FillReport|undefined):void {
  host.replaceChildren();const growth=report?.growth;if(!growth)return;
  const title=document.createElement('p');title.className='fill-growth-title';title.textContent=`本次实际放大 ${growth.enlarged} / ${growth.rows.length} 岛 · 新增有效 UV 面积 ${(growth.addedArea*100).toFixed(2)} 个百分点`;host.append(title);
  if(growth.densityLimited){const note=document.createElement('p');note.className='selection-help';note.textContent=`${growth.densityLimited} 个岛达到密度差上限。达到上限不表示没有空位；可主动调整上限后继续。不会自动放宽你设定的值。`;host.append(note);}
  const details=document.createElement('details');details.open=true;
  const summary=document.createElement('summary');summary.textContent='逐岛实际面积 / 边长增益（按 3D 面积排序）';details.append(summary);
  const scroll=document.createElement('div');scroll.className='fill-growth-scroll';
  const table=document.createElement('table');table.className='fill-growth-table';table.setAttribute('aria-label','Actual UV island enlargement');
  const head=document.createElement('thead'),tr=document.createElement('tr');
  for(const label of ['UV 岛','面积 ×','边长 ×','停止依据']){const th=document.createElement('th');th.textContent=label;tr.append(th);}head.append(tr);table.append(head);
  const body=document.createElement('tbody');
  for(const row of growth.rows){const tr=document.createElement('tr');tr.dataset.islandId=String(row.id);tr.dataset.areaFactor=String(row.areaFactor);
    for(const text of ['#'+(row.id+1),row.areaFactor.toFixed(3),row.linearFactor.toFixed(3),describeGrowthStop(row.reason)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
    tr.title=`UV 面积 ${row.areaBefore.toPrecision(6)} → ${row.areaAfter.toPrecision(6)}；3D 表面积 ${row.area3D.toPrecision(6)}。倍率相对本次操作前，不是相对模型原 UV。`;
    body.append(tr);
  }table.append(body);scroll.append(table);details.append(scroll);host.append(details);
  const foot=document.createElement('small');foot.textContent='面积 2 倍对应边长 √2 倍。仅移动 / 旋转记为 1 倍。记录来自最后提交的实际坐标；未找到更大位置不是全局不可放大的证明。';host.append(foot);
}

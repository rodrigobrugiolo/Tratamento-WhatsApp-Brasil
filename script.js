const PHONE_NAMES = ["telefone", "celular", "phone", "tel", "telephone"];
const NAME_NAMES = ["nome", "name"];
const SURNAME_NAMES = ["sobrenome", "lastname"];
const NUMERIC_THRESHOLD = 0.70;

function normalizeHeaderName(header) {
  return header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function correctName(str) {
  if (!str) return "";
  return str.split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function detectPhoneColumn(items, allHeaders) {
  let bestColumn = null;
  let bestRatio = 0;
  for (const header of allHeaders) {
    let numericCount = 0, nonEmptyCount = 0;
    for (const row of items) {
      const val = (row[header] || "").toString().trim();
      if (val !== "") {
        nonEmptyCount++;
        const justDigits = val.replace(/\D/g, "");
        const noSpacesLen = val.replace(/\s+/g, "").length;
        const ratio = (noSpacesLen > 0) ? justDigits.length / noSpacesLen : 0;
        if (ratio >= 0.7) numericCount++;
      }
    }
    if (nonEmptyCount > 0) {
      const colRatio = numericCount / nonEmptyCount;
      if (colRatio > bestRatio) {
        bestRatio = colRatio;
        bestColumn = header;
      }
    }
  }
  return (bestRatio >= NUMERIC_THRESHOLD) ? bestColumn : null;
}

function formatPhone(val) {
  if (!val) return "";
  let phone = val.toString().replace(/\D/g, '');
  if (phone.startsWith("55")) phone = phone.slice(2);
  if (phone.length >= 10 && phone.length <= 11) {
    const ddd = phone.slice(0, 2);
    let numero = phone.slice(2);
    const dddInt = parseInt(ddd, 10);
    if (dddInt >= 11 && dddInt <= 29 && numero.length === 8) {
      numero = '9' + numero;
    } else if (dddInt >= 30 && numero.length === 9 && numero.startsWith("9")) {
      numero = numero.slice(1);
    }
    return `55${ddd}${numero}`;
  }
  return val.toString();
}

function displayPreviewTable(data, maxRows = 10) {
  const container = document.getElementById('previewContainer');
  container.innerHTML = '<h3>Preview dos Dados Processados (primeiras linhas)</h3>';
  const table = document.createElement('table');
  const displayData = data.slice(0, maxRows + 1);
  displayData.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    row.forEach(cell => {
      const cellElement = document.createElement(rowIndex === 0 ? 'th' : 'td');
      cellElement.textContent = cell;
      tr.appendChild(cellElement);
    });
    table.appendChild(tr);
  });
  container.appendChild(table);
  if (data.length > maxRows + 1) {
    const note = document.createElement('p');
    note.textContent = `Exibindo ${maxRows} de ${data.length - 1} linhas de dados.`;
    note.style.fontSize = '14px';
    note.style.color = '#6c6b7b';
    container.appendChild(note);
  }
}

document.getElementById('processBtn').addEventListener('click', () => {
  const fileInput = document.getElementById('csvFileInput');
  if (!fileInput.files.length) {
    alert("Por favor, selecione um arquivo CSV.");
    return;
  }

  document.getElementById('previewContainer').innerHTML = '';
  document.getElementById('downloadLink').style.display = 'none';

  const file = fileInput.files[0];

  Papa.parse(file, {
    header: false,
    skipEmptyLines: true,
    complete: function(results) {
      const data = results.data;
      if (!data || data.length === 0) {
        alert("O arquivo CSV está vazio ou não pôde ser lido corretamente.");
        return;
      }

      const colCount = data[0].length;
      let headers = [];
      if (colCount > 0) headers.push("nome");
      if (colCount > 1) headers.push("telefone");
      for (let i = 2; i < colCount; i++) headers.push("coluna " + (i + 1));

      const items = data.map(row => {
        let obj = {};
        headers.forEach((h, i) => obj[h] = row[i] || "");
        return obj;
      });

      const nameCols = headers.filter(h => NAME_NAMES.includes(normalizeHeaderName(h)));
      const surnameCols = headers.filter(h => SURNAME_NAMES.includes(normalizeHeaderName(h)));
      const phoneCols = headers.filter(h => PHONE_NAMES.includes(normalizeHeaderName(h)));
      let detectedPhoneCol = phoneCols.length ? null : detectPhoneColumn(items, headers);

      const downloadData = items.map(row => {
        let r = { ...row };
        nameCols.forEach(col => r[col] = correctName(r[col]));
        surnameCols.forEach(col => r[col] = correctName(r[col]));
        if (phoneCols.length > 0) {
          phoneCols.forEach(col => r[col] = formatPhone(r[col]));
        } else if (detectedPhoneCol) {
          r[detectedPhoneCol] = formatPhone(r[detectedPhoneCol]);
        }
        return r;
      });

      const previewData = downloadData.map(row => {
        const masked = { ...row };
        nameCols.forEach(col => masked[col] = masked[col]?.substring(0, 3) + 'XXX');
        surnameCols.forEach(col => masked[col] = masked[col]?.substring(0, 3) + 'XXX');
        if (phoneCols.length > 0) {
          phoneCols.forEach(col => masked[col] = masked[col]?.substring(0, 5) + 'XXXX...');
        } else if (detectedPhoneCol) {
          masked[detectedPhoneCol] = masked[detectedPhoneCol]?.substring(0, 5) + 'XXXX...';
        }
        return masked;
      });

      const processedData = [headers, ...previewData.map(obj => headers.map(h => obj[h]))];
      displayPreviewTable(processedData, 10);

      const csv = Papa.unparse(downloadData, { header: true });
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const dlLink = document.createElement("a");
      dlLink.href = url;
      dlLink.download = `processado_${file.name}`;
      document.body.appendChild(dlLink);
      dlLink.click();
      document.body.removeChild(dlLink);
    },
    error: function(err) {
      alert("Erro ao processar o arquivo CSV: " + err);
    }
  });
});

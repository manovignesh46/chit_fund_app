import { useState, useEffect } from "react";
import { FixedAmountTemplateWithRows } from "@/app/lib/templateService";

interface TemplateSelectionProps {
  templates: FixedAmountTemplateWithRows[];
  onSelect: (templateId: number | null) => void;
  selectedTemplateId?: number | null;
}

export function TemplateSelection({
  templates,
  onSelect,
  selectedTemplateId,
}: TemplateSelectionProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<
    FixedAmountTemplateWithRows | null
  >(templates.find((t) => t.id === selectedTemplateId) ?? null);

  useEffect(() => {
    onSelect(selectedTemplate?.id ?? null);
  }, [selectedTemplate, onSelect]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Fixed Amount Template
        </label>
        <select
          value={selectedTemplate?.id ?? ""}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            setSelectedTemplate(
              id ? templates.find((t) => t.id === id) ?? null : null
            );
          }}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Select a template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} - {template.duration} months - ₹
              {template.totalAmount.toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      {selectedTemplate && (
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="font-medium mb-2">Template Preview</h4>
          <div className="grid grid-cols-4 gap-4">
            {selectedTemplate.amounts.map((amount) => (
              <div
                key={amount.month}
                className="p-2 bg-white rounded-md flex justify-between"
              >
                <span>Month {amount.month}:</span>
                <span>₹{amount.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

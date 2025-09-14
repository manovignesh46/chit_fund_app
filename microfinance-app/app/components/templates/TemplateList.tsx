import { useState } from "react";
import { FixedAmountTemplateWithRows } from "@/app/lib/templateService";
import { Button } from "@/app/components/common/Button";

interface TemplateListProps {
  templates: FixedAmountTemplateWithRows[];
  onEdit: (template: FixedAmountTemplateWithRows) => void;
  onDelete: (id: number) => void;
}

export function TemplateList({ templates, onEdit, onDelete }: TemplateListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <div
          key={template.id}
          className="bg-white rounded-lg shadow-md p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{template.name}</h3>
              {template.description && (
                <p className="text-gray-600">{template.description}</p>
              )}
              <p className="text-sm text-gray-500">
                Duration: {template.duration} months | Total Amount: ₹
                {template.totalAmount.toLocaleString()}
              </p>
            </div>
            <div className="space-x-2">
              <Button
                onClick={() => onEdit(template)}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Edit
              </Button>
              <Button
                onClick={() => onDelete(template.id)}
                className="bg-red-500 hover:bg-red-600"
              >
                Delete
              </Button>
              <Button
                onClick={() =>
                  setExpandedId(expandedId === template.id ? null : template.id)
                }
                className="bg-gray-500 hover:bg-gray-600"
              >
                {expandedId === template.id ? "Hide" : "View"} Details
              </Button>
            </div>
          </div>

          {expandedId === template.id && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Monthly Amounts</h4>
              <div className="grid grid-cols-4 gap-4">
                {template.amounts.map((amount) => (
                  <div
                    key={amount.month}
                    className="p-2 bg-gray-50 rounded-md flex justify-between"
                  >
                    <span>Month {amount.month}:</span>
                    <span>₹{amount.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

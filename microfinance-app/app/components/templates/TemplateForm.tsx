import { useState, useEffect } from "react";
import { FixedAmountTemplateWithRows } from "@/app/lib/templateService";
import { Button } from "@/app/components/common/Button";

interface TemplateFormProps {
  template?: FixedAmountTemplateWithRows;
  onSubmit: (data: {
    name: string;
    description?: string;
    totalAmount: number;
    duration: number;
    amounts: { month: number; amount: number }[];
  }) => void;
  onCancel: () => void;
}

export function TemplateForm({ template, onSubmit, onCancel }: TemplateFormProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [totalAmount, setTotalAmount] = useState(template?.totalAmount ?? 0);
  const [duration, setDuration] = useState(template?.duration ?? 20);
  const [amounts, setAmounts] = useState<{ month: number; amount: number }[]>(
    template?.amounts ?? []
  );

  // Initialize or update amounts when duration changes
  useEffect(() => {
    const newAmounts = Array.from({ length: duration }, (_, i) => {
      const existingAmount = amounts.find((a) => a.month === i + 1);
      return {
        month: i + 1,
        amount: existingAmount?.amount ?? Math.round(totalAmount / duration),
      };
    });
    setAmounts(newAmounts);
  }, [duration, totalAmount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      totalAmount,
      duration,
      amounts,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Total Amount
          </label>
          <input
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Duration (months)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
            min="1"
            max="60"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Monthly Amounts
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {amounts.map((amount, index) => (
            <div key={amount.month} className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Month {amount.month}
              </label>
              <input
                type="number"
                value={amount.amount}
                onChange={(e) => {
                  const newAmounts = [...amounts];
                  newAmounts[index].amount = Number(e.target.value);
                  setAmounts(newAmounts);
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                min="0"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          onClick={onCancel}
          className="bg-gray-500 hover:bg-gray-600"
        >
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-500 hover:bg-blue-600">
          {template ? "Update" : "Create"} Template
        </Button>
      </div>
    </form>
  );
}

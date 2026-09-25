interface Props {
  tab: string;
  setTab: (v: string) => void;
  showRequests: boolean;
  requestCount: number;
}

export default function GroupTabs({ tab, setTab, showRequests, requestCount }: Props) {
  const tabs = ["proposal", "members", ...(showRequests ? ["join-requests"] : []), "about"];

  return (
    <div className="flex gap-6 overflow-x-auto border-b">
      {tabs.map((item) => (
        <button
          key={item}
          onClick={() => setTab(item)}
          className={`pb-3 whitespace-nowrap capitalize ${tab === item ? "border-b-2 border-primary text-primary" : "text-gray-500"}`}
        >
          {item === "join-requests" ? `Join Requests (${requestCount})` : item}
        </button>
      ))}
    </div>
  );
}

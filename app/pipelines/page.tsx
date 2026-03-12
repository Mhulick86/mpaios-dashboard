import { pipelines } from "@/lib/pipelines";
import { PipelineCard } from "@/components/PipelineCard";

export default function PipelinesPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold">Pipelines</h1>
        <p className="text-[14px] text-text-secondary mt-1">
          {pipelines.length} orchestrated workflows with human review checkpoints
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {pipelines.map((pipeline) => (
          <PipelineCard key={pipeline.id} pipeline={pipeline} />
        ))}
      </div>
    </div>
  );
}

// Placeholder for agent list TypeScript logic
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { AgentService } from 'app/modules/admin/app/agents/my-agents/agent.service';
import { AgentProfile } from 'app/modules/admin/app/agents/my-agents/agent.interfaces'; // MODIFIED: Import AgentProfile instead of Agent
import { Observable } from 'rxjs';
import { AsyncPipe, NgFor, NgIf, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from 'environments/environment';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field'; // ADDED
import { MatSelectModule } from '@angular/material/select'; // ADDED
import { MatInputModule } from '@angular/material/input'; // ADDED
import { MatSlideToggleModule } from '@angular/material/slide-toggle'; // ADDED

@Component({
  selector: 'app-my-agents-list',
  templateUrl: './my-agents-list.component.html',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf,
    NgFor,
    AsyncPipe,
    MatIconModule,
    MatProgressSpinnerModule,
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule, // ADDED
    MatSelectModule, // ADDED
    MatInputModule, // ADDED
    MatSlideToggleModule // ADDED
  ]
})
export class MyAgentsListComponent implements OnInit, OnDestroy {
  private _agentService = inject(AgentService);
  private _router = inject(Router);
  private _route = inject(ActivatedRoute);
  agents$: Observable<AgentProfile[]>; // MODIFIED: Changed type to AgentProfile[]
  hashScanBaseUrl = environment.hashScanBaseUrl;

  // This will be inherited from the parent or managed globally if needed for filtering
  categories = [
    { slug: 'TRAVEL', title: 'Travel' },
    { slug: 'SOCIAL_MEDIA', title: 'Social Media' },
    { slug: 'CRYPTO', title: 'Crypto' },
    { slug: 'CONTENT_CREATION', title: 'Content Creation' },
    { slug: 'DATA_ANALYTICS', title: 'Data Analytics' },
    { slug: 'MARKET_INTELLIGENCE', title: 'Market Intelligence' },
    { slug: 'SECURITY', title: 'Security' },
  ];

  // This will be inherited from the parent or managed globally if needed for filtering
  hideOfflineAgents = false;
  currentCategoryFilter: string = 'all';
  currentQueryFilter: string = '';

  constructor() { }

  ngOnInit(): void {
    this.agents$ = this._agentService.getAgents();
  }

  toggleHideOffline(): void {
    this.hideOfflineAgents = !this.hideOfflineAgents;
  }

  filterByCategory(event: any): void {
    this.currentCategoryFilter = event.value;
  }

  filterByQuery(query: string): void {
    this.currentQueryFilter = query.toLowerCase();
  }

  trackByFnCategories(index: number, category: { slug: string; title: string }): string {
    return category.slug;
  }

  ngOnDestroy(): void {
    // Cleanup logic if needed
  }

  // MODIFIED: Parameter type changed to AgentProfile
  navigateToAgentProfilePage(agentAccountId: string): void { 
    if (!agentAccountId) {
      console.error('Agent account ID is undefined. Cannot navigate to profile page.');
      return;
    }
    this._router.navigate(['profile', agentAccountId], { relativeTo: this._route.parent });
  }

  // Filtering logic might be controlled by parent or a shared service
  // For now, keeping a simplified version or assuming parent handles filter inputs
  // MODIFIED: Parameter type changed to AgentProfile[]
  filteredAgents(agents: AgentProfile[]): AgentProfile[] { 
    if (!Array.isArray(agents)) return [];

    let filtered = agents;

    // Filter by offline status
    if (this.hideOfflineAgents) { // MODIFIED: Added parentheses
      filtered = filtered.filter(agent => !(agent.agentName && agent.agentName.toLowerCase() === 'no profile found'.toLowerCase()));
    }

    // Filter by category
    if (this.currentCategoryFilter !== 'all') {
      filtered = filtered.filter(agent => agent.agentCategory === this.currentCategoryFilter);
    }

    // Filter by search query (name or purpose)
    if (this.currentQueryFilter) {
      filtered = filtered.filter(agent => 
        (agent.agentName && agent.agentName.toLowerCase().includes(this.currentQueryFilter)) ||
        (agent.purpose && agent.purpose.toLowerCase().includes(this.currentQueryFilter))
      );
    }

    return filtered;
  }

  // MODIFIED: Parameter type changed to AgentProfile
  trackByFn(index: number, agent: AgentProfile): string { 
    return agent.agentAccountId; // Assuming agentAccountId is unique and suitable for trackBy
  }
}
